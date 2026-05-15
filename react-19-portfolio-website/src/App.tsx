import { motion, useReducedMotion } from "framer-motion";

type Project = {
  title: string;
  description: string;
  stack: string;
  href: string;
};

const projects: Project[] = [
  {
    title: "PulseBoard",
    description:
      "Real-time engineering analytics dashboard with event streaming, anomaly alerts, and role-based insights.",
    stack: "React, TypeScript, Node.js, PostgreSQL, WebSockets",
    href: "https://example.com/pulseboard",
  },
  {
    title: "ShipFlow",
    description:
      "CI/CD orchestration tool that cut deployment lead time by automating preview environments and rollback checks.",
    stack: "Next.js, Go, Docker, GitHub Actions, Redis",
    href: "https://example.com/shipflow",
  },
  {
    title: "SupportIQ",
    description:
      "AI-assisted support workspace that summarizes tickets and suggests responses directly in the agent dashboard.",
    stack: "React, Python, FastAPI, OpenAI API, Supabase",
    href: "https://example.com/supportiq",
  },
];

const experiences = [
  {
    role: "Senior Software Developer",
    company: "Northstar Labs",
    period: "2023 - Present",
    detail:
      "Leading frontend architecture for two SaaS products, improving Core Web Vitals and reducing defect escape rate through shared component standards.",
  },
  {
    role: "Software Developer",
    company: "Pixel Forge",
    period: "2020 - 2023",
    detail:
      "Built customer-facing features across React and Node services, with a focus on API performance and accessible UI patterns.",
  },
  {
    role: "Junior Developer",
    company: "BrightFrame",
    period: "2018 - 2020",
    detail:
      "Delivered full-stack features for internal operations tooling and collaborated closely with design and QA teams.",
  },
];

export default function App() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="bg-zinc-950 text-zinc-100 selection:bg-cyan-300 selection:text-zinc-900">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-zinc-950/80 backdrop-blur-sm">
        <nav
          className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4"
          aria-label="Main navigation"
        >
          <a href="#home" className="text-lg font-semibold tracking-wide text-white">
            Avery Morgan
          </a>
          <div className="flex items-center gap-6 text-sm text-zinc-300">
            <a href="#projects" className="transition hover:text-white">
              Projects
            </a>
            <a href="#experience" className="transition hover:text-white">
              Experience
            </a>
            <a href="#contact" className="transition hover:text-white">
              Contact
            </a>
          </div>
        </nav>
      </header>

      <main>
        <section id="home" className="relative isolate flex min-h-screen items-center overflow-hidden">
          <img
            src="/images/hero-workspace.jpg"
            alt="Developer workstation with code on monitors"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-zinc-950/70" />
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-transparent to-violet-500/20"
            animate={
              reduceMotion
                ? undefined
                : {
                    opacity: [0.4, 0.6, 0.4],
                  }
            }
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative mx-auto w-full max-w-6xl px-6 pt-28 pb-16">
            <motion.div
              initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="max-w-3xl"
            >
              <p className="mb-3 text-sm font-medium uppercase tracking-[0.2em] text-cyan-200">
                Software Developer Portfolio
              </p>
              <h1 className="text-5xl leading-tight font-semibold tracking-tight text-white sm:text-6xl md:text-7xl">
                Avery Morgan
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-zinc-200 sm:text-xl">
                I design and build resilient web products with React, TypeScript, and cloud-native tooling focused on speed, accessibility, and maintainability.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <a
                  href="#projects"
                  className="inline-flex items-center justify-center bg-cyan-300 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                >
                  View Projects
                </a>
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Contact Me
                </a>
              </div>
            </motion.div>
          </div>

          <motion.a
            href="#about"
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm tracking-wide text-zinc-200"
            animate={reduceMotion ? undefined : { y: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            Scroll
          </motion.a>
        </section>

        <section id="about" className="mx-auto max-w-6xl px-6 py-24">
          <motion.div
            initial={reduceMotion ? undefined : { opacity: 0, y: 20 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">About</h2>
            <p className="mt-5 text-lg leading-relaxed text-zinc-300">
              I am a product-minded engineer with 7+ years of experience shipping software across startups and growth-stage teams. My approach blends clean architecture, thoughtful user experience, and strong engineering collaboration to deliver features that last.
            </p>
          </motion.div>
        </section>

        <section id="projects" className="border-y border-white/10 bg-zinc-900/60">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Selected Projects</h2>
            <p className="mt-4 max-w-3xl text-zinc-300">
              A focused set of recent work spanning frontend architecture, backend services, and developer productivity.
            </p>
            <div className="mt-12 divide-y divide-white/10 border-t border-white/10">
              {projects.map((project, index) => (
                <motion.a
                  key={project.title}
                  href={project.href}
                  target="_blank"
                  rel="noreferrer"
                  initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.5, delay: index * 0.07 }}
                  className="group block py-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
                >
                  <h3 className="text-2xl font-medium text-white transition group-hover:text-cyan-200">{project.title}</h3>
                  <p className="mt-3 max-w-3xl text-zinc-300">{project.description}</p>
                  <p className="mt-3 text-sm uppercase tracking-wide text-zinc-400">{project.stack}</p>
                </motion.a>
              ))}
            </div>
          </div>
        </section>

        <section id="experience" className="mx-auto max-w-6xl px-6 py-24">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Experience</h2>
          <div className="mt-12 border-l border-white/15 pl-8">
            {experiences.map((item, index) => (
              <motion.article
                key={item.role}
                initial={reduceMotion ? undefined : { opacity: 0, x: -14 }}
                whileInView={reduceMotion ? undefined : { opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="relative pb-12 last:pb-0"
              >
                <span className="absolute -left-[2.18rem] mt-2 h-3 w-3 bg-cyan-300" aria-hidden="true" />
                <h3 className="text-xl font-medium text-white">{item.role}</h3>
                <p className="mt-1 text-zinc-300">
                  {item.company} | {item.period}
                </p>
                <p className="mt-3 max-w-3xl text-zinc-400">{item.detail}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="contact" className="border-t border-white/10 bg-zinc-900/60">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Contact</h2>
            <p className="mt-4 max-w-2xl text-zinc-300">
              I am open to full-time roles, consulting engagements, and engineering collaborations.
            </p>
            <div className="mt-10 grid gap-8 sm:grid-cols-2">
              <a
                href="mailto:avery@devmail.com"
                className="border border-white/15 px-6 py-5 transition hover:border-cyan-200 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              >
                <p className="text-sm uppercase tracking-wide text-zinc-400">Email</p>
                <p className="mt-2 text-lg text-white">avery@devmail.com</p>
              </a>
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="border border-white/15 px-6 py-5 transition hover:border-cyan-200 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              >
                <p className="text-sm uppercase tracking-wide text-zinc-400">LinkedIn</p>
                <p className="mt-2 text-lg text-white">linkedin.com/in/averymorgan</p>
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
