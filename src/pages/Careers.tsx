import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { CheckCircle2, MapPin, Briefcase, Paperclip, AlertCircle, Info } from "lucide-react";
import PageHero from "../components/ui/PageHero";
import { usePageMeta } from "../lib/usePageMeta";
import { apiGet, apiPostForm, ApiError } from "../lib/api";
import { benefits, jobOpenings as staticJobOpenings } from "../data/content";
import { cn } from "../lib/utils";

type JobOpening = {
  id: string;
  slug: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
};

const applicationSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(10, "Enter a valid phone number"),
  coverNote: z.string().min(10, "Say a little about why you're a fit"),
});

type ApplicationForm = z.infer<typeof applicationSchema>;

const GENERAL_APPLICATION = "general";

export default function Careers() {
  usePageMeta("Careers");
  const [department, setDepartment] = useState("All");
  const [submitted, setSubmitted] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [roleError, setRoleError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [isJobsFallback, setIsJobsFallback] = useState(false);

  useEffect(() => {
    apiGet<{ items: JobOpening[] }>("/api/jobs")
      .then((data) => {
        setJobs(data.items);
        setIsJobsFallback(false);
      })
      .catch(() => {
        setJobs(
          staticJobOpenings.map((j) => ({
            id: j.slug,
            slug: j.slug,
            title: j.title,
            department: j.department,
            location: j.location,
            type: j.type,
            description: j.description,
          }))
        );
        setIsJobsFallback(true);
      });
  }, []);

  const departments = useMemo(() => ["All", ...Array.from(new Set(jobs.map((j) => j.department)))], [jobs]);
  const filtered = useMemo(
    () => jobs.filter((j) => department === "All" || j.department === department),
    [jobs, department]
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApplicationForm>({ resolver: zodResolver(applicationSchema) });

  async function onSubmit(values: ApplicationForm) {
    setSubmitError(null);
    setRoleError(null);

    if (!selectedJobId) {
      setRoleError("Choose a role.");
      return;
    }
    if (!cvFile) {
      setFileError("Attach your CV to continue.");
      return;
    }
    setFileError(null);

    const isGeneral = selectedJobId === GENERAL_APPLICATION;
    const job = jobs.find((j) => j.id === selectedJobId);

    const formData = new FormData();
    formData.append("full_name", values.fullName);
    formData.append("email", values.email);
    formData.append("phone", values.phone);
    formData.append("role", isGeneral ? "General application" : job?.title ?? "");
    formData.append("cover_note", values.coverNote);
    if (!isGeneral && job) formData.append("job_id", job.id);
    formData.append("cv", cvFile);

    try {
      await apiPostForm("/api/careers/applications", formData);
      setSubmitted(true);
      reset();
      setCvFile(null);
      setSelectedJobId("");
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
        eyebrow="Careers"
        title="Build the lending Kenyan businesses actually need"
        description="We're a small team that spends a lot of time with borrowers directly - most roles involve real client contact, not just spreadsheets."
      />

      <section className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="rounded-2xl border border-mist-200 p-6"
            >
              <h3 className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                {b.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">{b.detail}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-16" style={{ backgroundColor: "var(--color-mist-100)" }}>
        <div className="mx-auto max-w-5xl px-5 lg:px-8">
          <h2 className="mb-8 text-center font-display text-2xl font-extrabold sm:text-3xl" style={{ color: "var(--color-ink-900)" }}>
            Open roles
          </h2>

          {isJobsFallback && (
            <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 text-xs text-ink-500">
              <Info size={14} className="shrink-0" />
              Showing saved job listings - we couldn't reach the server for the latest openings.
            </div>
          )}

          {jobs.length === 0 && (
            <p className="text-center text-sm text-ink-500">No open roles right now - check back soon.</p>
          )}

          {jobs.length > 0 && (
            <div className="mb-8 flex flex-wrap justify-center gap-2">
              {departments.map((d) => (
                <button
                  key={d}
                  onClick={() => setDepartment(d)}
                  className={cn(
                    "rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:text-sm",
                    department === d ? "text-white" : "border border-mist-200 bg-surface text-ink-700 hover:bg-mist-50"
                  )}
                  style={department === d ? { backgroundColor: "var(--color-navy-900)" } : undefined}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-4">
            {filtered.map((job) => (
              <div key={job.slug} className="flex flex-col gap-3 rounded-2xl bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-base font-bold" style={{ color: "var(--color-ink-900)" }}>
                      {job.title}
                    </h3>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ backgroundColor: "var(--color-ember-100)", color: "var(--color-ember-600)" }}
                    >
                      {job.type}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-ink-500">
                    <span className="flex items-center gap-1.5">
                      <Briefcase size={13} />
                      {job.department}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin size={13} />
                      {job.location}
                    </span>
                  </div>
                  <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-ink-700">{job.description}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedJobId(job.id);
                    setRoleError(null);
                  }}
                  className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
                  style={{ backgroundColor: "var(--color-navy-900)" }}
                >
                  Apply
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-5 py-16 lg:py-20">
        <h2 className="mb-8 text-center font-display text-2xl font-extrabold" style={{ color: "var(--color-ink-900)" }}>
          Send us your application
        </h2>

        <div className="rounded-3xl border border-mist-200 bg-surface p-5 sm:p-7">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 size={40} style={{ color: "var(--color-ember-500)" }} />
              <h3 className="mt-4 font-display text-lg font-bold" style={{ color: "var(--color-ink-900)" }}>
                Application received
              </h3>
              <p className="mt-2 max-w-xs text-sm text-ink-500">
                Our recruitment team reviews applications weekly and will reach out if there's a fit.
              </p>
              <button onClick={() => setSubmitted(false)} className="mt-6 text-sm font-semibold" style={{ color: "var(--color-ember-500)" }}>
                Submit another application
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
                  <input {...register("fullName")} className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none" />
                  {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-ink-500">Phone number</label>
                  <input {...register("phone")} className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none" />
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-ink-500">Email address</label>
                <input {...register("email")} className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none" />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-ink-500">Role you're applying for</label>
                <select
                  value={selectedJobId}
                  onChange={(e) => {
                    setSelectedJobId(e.target.value);
                    setRoleError(null);
                  }}
                  className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm text-ink-700 focus:outline-none"
                >
                  <option value="" disabled>Choose a role</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.title}</option>
                  ))}
                  <option value={GENERAL_APPLICATION}>General application</option>
                </select>
                {roleError && <p className="mt-1 text-xs text-red-500">{roleError}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-ink-500">Why you're a fit</label>
                <textarea
                  {...register("coverNote")}
                  rows={4}
                  className="w-full rounded-xl border border-mist-200 px-4 py-2.5 text-sm focus:outline-none"
                />
                {errors.coverNote && <p className="mt-1 text-xs text-red-500">{errors.coverNote.message}</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-ink-500">CV (PDF)</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-mist-200 px-4 py-3 text-sm text-ink-500 hover:bg-mist-50">
                  <Paperclip size={15} />
                  {cvFile?.name ?? "Attach your CV"}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setCvFile(file);
                      setFileError(null);
                    }}
                  />
                </label>
                {fileError && <p className="mt-1 text-xs text-red-500">{fileError}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-full py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.01] disabled:opacity-60"
                style={{ backgroundColor: "var(--color-ember-500)" }}
              >
                {isSubmitting ? "Sending…" : "Submit Application"}
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
