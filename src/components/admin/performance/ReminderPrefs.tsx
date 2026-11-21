import { useEffect, useState } from "react";
import { getNotifyPrefs, saveNotifyPrefs, sendTestReminder, type NotifyPrefs } from "../../../lib/performanceApi";

const input = "rounded-lg border border-mist-200 px-2 py-1.5 text-sm";
const btn = "rounded-full border border-mist-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-mist-50 disabled:opacity-50";

/** Where my reminders go besides the bell. Messages never contain names or performance details. */
export default function ReminderPrefs() {
  const [p, setP] = useState<NotifyPrefs | null>(null);
  const [emailOn, setEmailOn] = useState(true);
  const [smsOn, setSmsOn] = useState(false);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    getNotifyPrefs()
      .then((d) => {
        setP(d);
        setEmailOn(d.email_on);
        setSmsOn(d.sms_on);
        setPhone(d.phone ?? "");
      })
      .catch(() => undefined);
  }, []);
  if (!p) return null;
  const run = async (fn: () => Promise<string>) => {
    setErr(null);
    setNote(null);
    try {
      setNote(await fn());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That didn't work.");
    }
  };
  return (
    <details className="rounded-2xl border border-mist-200 p-4">
      <summary className="cursor-pointer text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>How I get reminders</summary>
      <div className="mt-3 space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={emailOn} onChange={(e) => setEmailOn(e.target.checked)} />
          <span>Email{p.email_address_on_file ? "" : " (no email address on your login, so none can be sent)"}{p.email_available ? "" : " (email isn't set up yet)"}</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={smsOn} onChange={(e) => setSmsOn(e.target.checked)} />
          <span>SMS{p.sms_available ? "" : " (SMS isn't set up yet)"}</span>
        </label>
        <label className="block text-xs text-ink-600">
          <span className="block font-semibold">Phone number for SMS</span>
          <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" autoComplete="tel" placeholder="0712 345 678" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={() => run(async () => { await saveNotifyPrefs({ email_on: emailOn, sms_on: smsOn, phone: phone.trim() || null }); return "Saved."; })}>Save</button>
          <button className={btn} onClick={() => run(async () => `Test: ${Object.entries((await sendTestReminder()).results).map(([k, v]) => `${k} ${v}`).join(", ") || "nothing to send (all channels are off)"}`)}>Send me a test</button>
        </div>
        {note && <p role="status" className="text-xs text-ink-600">{note}</p>}
        {err && <p role="alert" className="text-xs text-red-600">{err}</p>}
        <p className="text-xs text-ink-500">Reminders say how many items need you, never who or why.</p>
      </div>
    </details>
  );
}
