import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { Quote } from "lucide-react";
import { testimonials } from "../../data/content";
import "swiper/css";
import "swiper/css/pagination";

export default function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-ember-500)" }}>
          Customer Stories
        </p>
        <h2 className="mt-3 font-display text-3xl font-extrabold lg:text-4xl" style={{ color: "var(--color-ink-900)" }}>
          Borrowers who put it to work
        </h2>
      </div>

      <Swiper
        modules={[Autoplay, Pagination]}
        spaceBetween={24}
        slidesPerView={1}
        breakpoints={{ 768: { slidesPerView: 2 }, 1024: { slidesPerView: 3 } }}
        autoplay={{ delay: 5000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        className="!pb-12"
      >
        {testimonials.map((t) => (
          <SwiperSlide key={t.name}>
            <div className="flex h-full flex-col rounded-2xl border border-mist-200 bg-surface p-5 sm:p-7">
              <Quote size={26} style={{ color: "var(--color-ember-500)" }} />
              <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-700">"{t.quote}"</p>
              <div className="mt-6 border-t border-mist-200 pt-4">
                <p className="font-display text-sm font-bold" style={{ color: "var(--color-ink-900)" }}>
                  {t.name}
                </p>
                <p className="text-xs text-ink-500">{t.role}</p>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}
