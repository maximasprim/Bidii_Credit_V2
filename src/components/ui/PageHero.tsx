import { motion } from "framer-motion";
import type { ReactNode } from "react";
import GrowthLine from "./GrowthLine";
import heroBackground from "../../assets/Hero_Bg2.jpg";

export default function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden bg-top bg-no-repeat bg-cover bg-center sm:bg-center px-5 py-20 lg:px-8 lg:py-28"
       style={{
        backgroundImage: `url(${heroBackground})`,
        // backgroundColor: "var(--color-navy-900)",
      }}
    >
      <div className="absolute inset-0" 
      style={{
        background:
          "radial-gradient(ellipse 90% 60% at 20% 0%, var(--color-navy-700) 0%, var(--color-navy-900) 45%, var(--color-navy-950) 100%)",
        opacity: 0.75,
       }} 
       />
  
      <GrowthLine
        className="pointer-events-none absolute -top-2 right-0 h-32 w-[55%] opacity-20 lg:h-44 lg:w-[35%]"
        stroke="var(--color-ember-400)"
        animate={false}
      />
      <div className="relative mx-auto max-w-4xl text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-ember-400)" }}
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="mt-3 font-display text-3xl font-extrabold text-white sm:text-4xl lg:text-5xl"
        >
          {title}
        </motion.h1>
        {description && (
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/65"
          >
            {description}
          </motion.p>
        )}
        {children}
      </div>
    </section>
  );
}
