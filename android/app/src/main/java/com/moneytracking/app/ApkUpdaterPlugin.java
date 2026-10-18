package com.moneytracking.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Tải file APK bản mới từ GitHub Releases rồi mở trình cài đặt của Android.
 * Gọi từ JS: ApkUpdater.downloadAndInstall({ url, fileName }), lắng nghe sự kiện "progress".
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "update.apk");
        if (url == null) {
            call.reject("Thiếu đường dẫn tải");
            return;
        }
        // Android 8+: cần cho phép "cài ứng dụng không rõ nguồn gốc" cho app này
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.reject("Hãy cho phép cài ứng dụng từ nguồn này rồi bấm Cập nhật lại", "NEED_PERMISSION");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                if (!dir.exists()) dir.mkdirs();
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) f.delete();
                File out = new File(dir, fileName);

                HttpURLConnection conn = open(url);
                long total = conn.getContentLengthLong();
                try (InputStream in = conn.getInputStream(); FileOutputStream fos = new FileOutputStream(out)) {
                    byte[] buf = new byte[64 * 1024];
                    long done = 0;
                    int n;
                    int lastPct = -1;
                    while ((n = in.read(buf)) != -1) {
                        fos.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int pct = (int) (done * 100 / total);
                            if (pct != lastPct) {
                                lastPct = pct;
                                JSObject p = new JSObject();
                                p.put("percent", pct);
                                notifyListeners("progress", p);
                            }
                        }
                    }
                } finally {
                    conn.disconnect();
                }

                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", out);
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(uri, "application/vnd.android.package-archive");
                install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(install);
                call.resolve();
            } catch (Exception e) {
                call.reject("Tải bản cập nhật lỗi: " + e.getMessage());
            }
        }).start();
    }

    // Tự theo redirect (GitHub chuyển hướng sang máy chủ chứa file)
    private HttpURLConnection open(String url) throws Exception {
        for (int i = 0; i < 6; i++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(20000);
            c.setReadTimeout(60000);
            c.setRequestProperty("Accept", "application/octet-stream");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) {
                url = c.getHeaderField("Location");
                c.disconnect();
                continue;
            }
            if (code != 200) throw new Exception("HTTP " + code);
            return c;
        }
        throw new Exception("Quá nhiều lần chuyển hướng");
    }
}
