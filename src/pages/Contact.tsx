import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, MapPin, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import PageHero from "../components/ui/PageHero";
import { usePageMeta } from "../lib/usePageMeta";
import { apiPost, ApiError } from "../lib/api";
import { submitCrmLead } from "../lib/crmApi";

const contactSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
  subject: z.string().min(1, "Choose a subject"),
  message: z.string().min(10, "Message should be at least 10 characters"),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function Contact() {
  usePageMeta("Contact Us");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>({ resolver: zodResolver(contactSchema) });

  async function onSubmit(values: ContactForm) {
    setSubmitError(null);
    try {
      await apiPost("/api/contact", values);
      setSubmitted(true);
      reset();
            // Fire-and-forget: they've already given us everything the CRM
      // needs, so create the lead silently instead of asking again.
      void submitCrmLead({
        fullName: values.name,
        phone: values.phone,
        email: values.email,
        sourcePage: "contact",
        trigger: "contact_submit",
        message: `${values.subject}: ${values.message}`,
      });
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the server. Check your connection and try again."
      );
    }
  }

  return (
    <>
      <PageHero
        eyebrow="Contact Us"
        title="Talk to a real loan officer"
        description="Reach us by phone, email, or visit a branch. For fastest response on an existing application, call the branch handling it directly."
      />

      <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-mist-200 p-6">
              <Phone size={18} style={{ color: "var(--color-ink-900)" }} />
              <p className="mt-3 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                Call us
              </p>
              <p className="mt-1 text-sm text-ink-500">+254 709 840 000</p>
              <p className="text-xs text-ink-500">Mon–Fri 8:00-17:00, Sat 9:00-13:00</p>
            </div>
            <div className="rounded-2xl border border-mist-200 p-6">
              <Mail size={18} style={{ color: "var(--color-ink-900)" }} />
              <p className="mt-3 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                Email us
              </p>
              <p className="mt-1 text-sm text-ink-500">info@bidiicreditkenya.co.ke</p>
            </div>
            <div className="rounded-2xl border border-mist-200 p-6">
              <MapPin size={18} style={{ color: "var(--color-ink-900)" }} />
              <p className="mt-3 font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                Head office
              </p>
              <p className="mt-1 text-sm text-ink-500">Applewood Adams, Ngong Road, Nairobi</p>
            </div>
          </div>

          <div className="rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7 lg:p-9">
            {submitted ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 size={40} style={{ color: "var(--color-ember-500)" }} />
                <h2 className="mt-4 font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
                  Message sent
                </h2>
                <p className="mt-2 max-w-xs text-sm text-ink-500">
                  A member of our team will get back to you within one business day.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-6 text-sm font-semibold"
                  style={{ color: "var(--color-ember-500)" }}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                {submitError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    {submitError}
                  </div>
                )}
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm text-ink-500">Full name</label>
                    <input
                      {...register("name")}
                      className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
                    />
                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm text-ink-500">Phone number</label>
                    <input
                      {...register("phone")}
                      className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
                    />
                    {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-ink-500">Email address</label>
                  <input
                    {...register("email")}
                    className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
                  />
                  {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-ink-500">Subject</label>
                  <select
                    {...register("subject")}
                    defaultValue=""
                    className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
                  >
                    <option value="" disabled>Choose a subject</option>
                    <option value="loan-inquiry">Loan Inquiry</option>
                    <option value="existing-loan">Existing Loan</option>
                    <option value="complaint">Complaint</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.subject && <p className="mt-1 text-xs text-red-500">{errors.subject.message}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm text-ink-500">Message</label>
                  <textarea
                    {...register("message")}
                    rows={4}
                    className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
                  />
                  {errors.message && <p className="mt-1 text-xs text-red-500">{errors.message.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-full py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
                  style={{ backgroundColor: "var(--color-ember-500)" }}
                >
                  {isSubmitting ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
