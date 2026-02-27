import { useState, useEffect } from 'react';
import './Settings.css';

const STORAGE_KEYS = {
  SESSION_KEY: 'doraemon_session_key',
  API_KEY: 'doraemon_api_key',
  API_BASE: 'doraemon_api_base',
  MODEL: 'doraemon_model',
};

export function loadSettings() {
  try {
    return {
      sessionKey: localStorage.getItem(STORAGE_KEYS.SESSION_KEY) || '',
      apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
      apiBase: localStorage.getItem(STORAGE_KEYS.API_BASE) || 'https://api.openai.com/v1/chat/completions',
      model: localStorage.getItem(STORAGE_KEYS.MODEL) || 'gpt-3.5-turbo',
    };
  } catch {
    return {
      sessionKey: '',
      apiKey: '',
      apiBase: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo',
    };
  }
}

function saveSettings(settings) {
  try {
    if (settings.sessionKey) {
      localStorage.setItem(STORAGE_KEYS.SESSION_KEY, settings.sessionKey);
      // 同时设置到 window 对象，供 aiService.js 读取
      if (typeof window !== 'undefined') {
        window.OPENCLAW_SESSION_KEY = settings.sessionKey;
      }
    } else {
      localStorage.removeItem(STORAGE_KEYS.SESSION_KEY);
    }

    if (settings.apiKey) {
      localStorage.setItem(STORAGE_KEYS.API_KEY, settings.apiKey);
    } else {
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
    }

    if (settings.apiBase) {
      localStorage.setItem(STORAGE_KEYS.API_BASE, settings.apiBase);
    }

    if (settings.model) {
      localStorage.setItem(STORAGE_KEYS.MODEL, settings.model);
    }

    return true;
  } catch (err) {
    console.error('保存设置失败:', err);
    return false;
  }
}

export default function Settings({ open, onClose, onSave }) {
  const [settings, setSettings] = useState(loadSettings());
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    if (open) {
      setSettings(loadSettings());
      setSaveStatus('');
    }
  }, [open]);

  const handleSave = () => {
    const success = saveSettings(settings);
    if (success) {
      setSaveStatus('✓ 设置已保存');
      setTimeout(() => {
        setSaveStatus('');
        onClose();
        if (onSave) onSave(settings);
      }, 800);
    } else {
      setSaveStatus('✗ 保存失败');
    }
  };

  const handleReset = () => {
    if (confirm('确定要清空所有配置吗？')) {
      const emptySettings = {
        sessionKey: '',
        apiKey: '',
        apiBase: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-3.5-turbo',
      };
      setSettings(emptySettings);
      saveSettings(emptySettings);
      setSaveStatus('✓ 配置已清空');
      setTimeout(() => setSaveStatus(''), 1500);
    }
  };

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ 设置</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          <section>
            <h3>🔑 OpenClaw Gateway</h3>
            <div className="form-group">
              <label htmlFor="sessionKey">Session Key</label>
              <input
                id="sessionKey"
                type="password"
                value={settings.sessionKey}
                onChange={(e) => setSettings({ ...settings, sessionKey: e.target.value })}
                placeholder="输入 OpenClaw Session Key（推荐）"
                autoComplete="off"
              />
              <small>用于连接本地 OpenClaw Gateway，无需 API Key</small>
            </div>
          </section>

          <section>
            <h3>🌐 OpenAI API（备选）</h3>
            <div className="form-group">
              <label htmlFor="apiKey">API Key</label>
              <input
                id="apiKey"
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label htmlFor="apiBase">API Base URL</label>
              <input
                id="apiBase"
                type="text"
                value={settings.apiBase}
                onChange={(e) => setSettings({ ...settings, apiBase: e.target.value })}
                placeholder="https://api.openai.com/v1/chat/completions"
              />
            </div>

            <div className="form-group">
              <label htmlFor="model">模型</label>
              <input
                id="model"
                type="text"
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                placeholder="gpt-3.5-turbo"
              />
            </div>
          </section>

          <section className="info-section">
            <p>💡 <strong>推荐使用 OpenClaw Gateway</strong></p>
            <p>使用本地 Gateway API，无需额外配置，支持流式输出和上下文管理。</p>
          </section>
        </div>

        <div className="settings-footer">
          <div className={`save-status ${saveStatus ? 'show' : ''}`}>
            {saveStatus}
          </div>
          <div className="button-group">
            <button className="reset-btn" onClick={handleReset}>清空配置</button>
            <button className="save-btn" onClick={handleSave}>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
