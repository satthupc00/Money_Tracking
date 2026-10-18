import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Delete, Fingerprint, Eye, EyeOff, ArrowRight } from 'lucide-react';
import Logo from './Logo.jsx';
import { hashSecret, legacyHash, isNativeApp } from '../platform.js';

const isV2Hash = (h) => /^[0-9a-f]{64}$/.test(h || '');

function Brand() {
  return (
    <>
      <Logo className="logo" />
      <div className="nm">
        <span className="m">Mon</span> Money Tracking
      </div>
    </>
  );
}

// Màn khoá / màn tạo khoá lần đầu.
// pc = true: 1 ô mật khẩu dài nhập tự do. pc = false: bàn phím số PIN + vân tay.
export default function LockScreen({ pc, mode, lockHash, pinLength, biometricEnabled, onSetLock, onUnlocked, onUpgradeHash, onForgot }) {
  const [input, setInput] = useState('');
  const [first, setFirst] = useState(null); // lần nhập đầu khi tạo khoá
  const [msg, setMsg] = useState({ text: '', err: false });
  const [shake, setShake] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [confirm, setConfirm] = useState('');
  const pwRef = useRef(null);
  const bioTried = useRef(false);

  const fail = (text) => {
    setMsg({ text, err: true });
    setShake(true);
    setTimeout(() => setShake(false), 420);
    setInput('');
    if (pwRef.current) pwRef.current.focus();
  };
  const leave = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onUnlocked(), 430);
  }, [onUnlocked]);

  const matches = (s) => {
    if (!lockHash) return false;
    if (isV2Hash(lockHash)) return hashSecret(s) === lockHash;
    // mã PIN đặt từ bản 1.x -> đúng thì tự nâng cấp lên SHA-256
    if (legacyHash(s) === lockHash) {
      onUpgradeHash(hashSecret(s), s.length);
      return true;
    }
    return false;
  };

  // ---- Vân tay ----
  const tryBiometric = useCallback(async () => {
    if (!isNativeApp() || !biometricEnabled || mode !== 'unlock') return;
    try {
      const { NativeBiometric } = await import('capacitor-native-biometric');
      const avail = await NativeBiometric.isAvailable();
      if (!avail || !avail.isAvailable) return;
      await NativeBiometric.verifyIdentity({ reason: 'Mở khoá Mon Money Tracking', title: 'Mở khoá', subtitle: 'Dùng vân tay của bạn', description: '' });
      leave();
    } catch (e) {
      /* huỷ hoặc thất bại -> dùng mã PIN */
    }
  }, [biometricEnabled, mode, leave]);
  useEffect(() => {
    if (!pc && mode === 'unlock' && !bioTried.current) {
      bioTried.current = true;
      tryBiometric();
    }
  }, [pc, mode, tryBiometric]);

  // ---- PIN (điện thoại) ----
  const press = (d) => {
    if (leaving) return;
    setMsg({ text: '', err: false });
    setInput((prev) => (prev.length < 10 ? prev + d : prev));
  };
  useEffect(() => {
    if (pc || !input) return;
    if (mode === 'unlock') {
      if (matches(input)) leave();
      else if (pinLength && input.length >= pinLength) fail('Sai mã PIN, thử lại');
    } else if (first !== null && input.length >= first.length) {
      if (input === first) {
        onSetLock(hashSecret(input), input.length);
        leave();
      } else {
        setFirst(null);
        fail('Hai lần nhập không khớp, tạo lại mã PIN');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);
  const pinNext = () => {
    if (mode === 'unlock') {
      if (!matches(input)) fail('Sai mã PIN, thử lại');
      else leave();
      return;
    }
    if (input.length < 4) return;
    setFirst(input);
    setInput('');
    setMsg({ text: '', err: false });
  };

  // ---- Mật khẩu (PC) ----
  const submitPw = (e) => {
    e.preventDefault();
    if (mode === 'unlock') {
      if (input && matches(input)) leave();
      else fail('Sai mật khẩu');
      return;
    }
    if (!input) return fail('Hãy nhập mật khẩu');
    if (input !== confirm) {
      setConfirm('');
      return fail('Hai mật khẩu không khớp');
    }
    onSetLock(hashSecret(input), 0);
    leave();
  };

  if (pc) {
    const setup = mode === 'setup';
    return (
      <div className={'lock' + (leaving ? ' out' : '')}>
        <div className="drag" />
        <Brand />
        <div className={'hint' + (msg.err ? ' err' : '')}>{msg.text || (setup ? 'Đặt mật khẩu để bảo vệ dữ liệu trên máy này' : '')}</div>
        <form className={'pw' + (shake ? ' shake' : '')} onSubmit={submitPw} autoComplete="off">
          <input
            ref={pwRef}
            type={showPw ? 'text' : 'password'}
            placeholder={setup ? 'Mật khẩu mới' : 'Mật khẩu'}
            aria-label="Mật khẩu"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="button" className="ibtn" title="Hiện/ẩn mật khẩu" onClick={() => setShowPw((v) => !v)}>
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          {!setup && (
            <button className="ibtn go" title="Mở khóa (Enter)">
              <ArrowRight size={18} />
            </button>
          )}
        </form>
        {setup && (
          <form className="pw" onSubmit={submitPw} autoComplete="off">
            <input type={showPw ? 'text' : 'password'} placeholder="Nhập lại mật khẩu" aria-label="Nhập lại mật khẩu" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <button className="ibtn go" title="Lưu mật khẩu (Enter)">
              <ArrowRight size={18} />
            </button>
          </form>
        )}
        {setup ? (
          <div className="muted" style={{ fontSize: 12, textAlign: 'center', maxWidth: 360 }}>
            Mật khẩu nhập tự do, phân biệt chữ hoa/thường. Chỉ lưu trên máy này (đã mã hoá), không gửi lên mạng.
          </div>
        ) : (
          <button className="link" onClick={onForgot}>
            Quên mật khẩu?
          </button>
        )}
        <div className="credit">Created by Mondiro</div>
      </div>
    );
  }

  const setup = mode === 'setup';
  const dotsCount = setup ? Math.max(4, first ? first.length : input.length) : pinLength || Math.max(4, input.length);
  const hint = msg.text || (setup ? (first ? 'Nhập lại mã PIN' : 'Tạo mã PIN (4–10 số)') : 'Nhập mã PIN');
  return (
    <div className={'lock' + (leaving ? ' out' : '')}>
      <Brand />
      <div className={'hint' + (msg.err ? ' err' : '')}>{hint}</div>
      <div className={'dots' + (shake ? ' shake' : '')}>
        {Array.from({ length: dotsCount }, (_, i) => (
          <i key={i} className={i < input.length ? 'f' : ''} />
        ))}
      </div>
      <div className="pad num">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        {(setup && !first) || (!setup && !pinLength) ? (
          <button className="ghost" style={{ fontSize: 15, fontWeight: 700, color: input.length >= 4 ? 'var(--red)' : undefined }} onClick={pinNext} disabled={input.length < 4}>
            OK
          </button>
        ) : (
          <span />
        )}
        <button onClick={() => press('0')}>0</button>
        <button className="ghost" onClick={() => setInput((p) => p.slice(0, -1))} aria-label="Xoá">
          <Delete size={24} />
        </button>
      </div>
      {!setup && isNativeApp() && biometricEnabled && (
        <div className="fp">
          <button onClick={tryBiometric} aria-label="Mở khoá bằng vân tay">
            <Fingerprint size={30} />
          </button>
          Chạm để dùng vân tay
        </div>
      )}
      {!setup && (
        <button className="link" onClick={onForgot}>
          Quên mã PIN?
        </button>
      )}
      <div className="credit">Created by Mondiro</div>
    </div>
  );
}
