import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  PhoneCall,
  Wallet,
  Users,
  Sparkles,
  Check,
  Star,
  Gift,
  Send,
  Bell,
  Globe2,
  Heart,
  Smile,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import testimonial1 from "@/assets/testimonial-1.jpg";
import testimonial2 from "@/assets/testimonial-2.jpg";
import testimonial3 from "@/assets/testimonial-3.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AfriFlow — Travaillez avec le monde entier, soyez payé sur Mobile Money" },
      {
        name: "description",
        content:
          "Un numéro pro international, des clients organisés et vos paiements directement sur Orange Money, MTN, Wave. Tout depuis un seul endroit.",
      },
      { property: "og:title", content: "AfriFlow — Travaillez comme un pro international" },
      {
        property: "og:description",
        content:
          "Votre numéro pro, vos clients et vos paiements internationaux — reçus sur votre Mobile Money. Pensé pour les freelances africains.",
      },
    ],
  }),
  component: Landing,
});

const momoBrands = [
  { name: "Orange Money", color: "oklch(0.72 0.18 60)" },
  { name: "MTN MoMo", color: "oklch(0.85 0.16 85)" },
  { name: "Wave", color: "oklch(0.6 0.2 255)" },
  { name: "Moov Money", color: "oklch(0.55 0.18 270)" },
  { name: "Airtel Money", color: "oklch(0.62 0.22 25)" },
];

const countries = [
  { flag: "🇫🇷", label: "France", code: "+33" },
  { flag: "🇧🇪", label: "Belgique", code: "+32" },
  { flag: "🇺🇸", label: "États-Unis", code: "+1" },
  { flag: "🇨🇦", label: "Canada", code: "+1" },
];

const steps = [
  {
    n: "1",
    icon: PhoneCall,
    title: "Choisissez votre numéro pro",
    desc: "France, Belgique, Canada ou États-Unis. Votre numéro est prêt en quelques minutes, depuis votre navigateur.",
    accent: "primary",
  },
  {
    n: "2",
    icon: Send,
    title: "Appelez vos clients et envoyez vos liens",
    desc: "Passez vos appels, créez un lien de paiement, partagez-le sur WhatsApp ou par email. Votre client paie en un clic.",
    accent: "teal",
  },
  {
    n: "3",
    icon: Wallet,
    title: "Recevez votre argent sur Mobile Money",
    desc: "Vos paiements arrivent directement sur Orange Money, MTN, Wave ou Moov. Sans banque étrangère, sans paperasse.",
    accent: "sun",
  },
];

const features = [
  {
    icon: PhoneCall,
    title: "Votre numéro professionnel",
    desc: "Donnez à vos clients un numéro local qu’ils peuvent appeler comme s’ils étaient à côté.",
    tone: "blue",
  },
  {
    icon: Send,
    title: "Paiements simplifiés",
    desc: "Envoyez un lien, votre client paie par carte. Vous voyez l’argent arriver en temps réel.",
    tone: "teal",
  },
  {
    icon: Wallet,
    title: "Argent reçu sur Mobile Money",
    desc: "Orange, MTN, Wave, Moov, Airtel. Vos paiements arrivent là où vous les utilisez déjà.",
    tone: "sun",
  },
  {
    icon: Users,
    title: "Vos clients organisés",
    desc: "Un client, une fiche. Vos appels, vos notes, vos paiements — toujours au même endroit.",
    tone: "rose",
  },
  {
    icon: Bell,
    title: "Notifications en temps réel",
    desc: "Soyez prévenu dès qu’un client vous paie ou vous rappelle. Plus jamais d’oubli.",
    tone: "violet",
  },
  {
    icon: Globe2,
    title: "Pensé pour vos réseaux",
    desc: "Léger, rapide, simple. Fonctionne très bien depuis Dakar, Abidjan, Douala ou Bamako.",
    tone: "blue",
  },
];

const testimonials = [
  {
    name: "Aïssatou Diop",
    role: "Consultante UX · Dakar",
    avatar: testimonial1,
    quote:
      "Avant, mon client à Paris mettait une semaine à me payer. Aujourd’hui, je reçois mon argent sur Wave le lendemain.",
  },
  {
    name: "Koffi N’Guessan",
    role: "Développeur freelance · Abidjan",
    avatar: testimonial2,
    quote:
      "Mon client canadien voulait pouvoir m’appeler sans frais. En deux minutes, j’avais un numéro pro. Ça change tout.",
  },
  {
    name: "Mariama Bâ",
    role: "Coach business · Bamako",
    avatar: testimonial3,
    quote:
      "J’envoie un lien sur WhatsApp, mes clientes en Belgique paient par carte, et l’argent arrive directement sur mon Orange Money.",
  },
];

const faqs = [
  {
    q: "Pour qui c’est ?",
    a: "Pour tous les freelances et indépendants en Afrique qui ont — ou veulent avoir — des clients à l’étranger. Développeurs, designers, coachs, consultants, agences.",
  },
  {
    q: "Faut-il une carte bancaire pour commencer ?",
    a: "Non. Vous obtenez votre numéro pro et 10 minutes d’appels offertes sans aucune carte. Vous explorez tout le produit librement.",
  },
  {
    q: "Sur quel compte mon argent arrive-t-il ?",
    a: "Sur votre Mobile Money : Orange Money, MTN, Wave, Moov ou Airtel. La conversion en monnaie locale est automatique.",
  },
  {
    q: "Combien coûte un appel ?",
    a: "Vous payez seulement les minutes que vous utilisez. Le tarif est affiché clairement avant chaque appel, sans surprise.",
  },
  {
    q: "Mes clients à l’étranger paient comment ?",
    a: "Par carte bancaire (Visa, Mastercard), Apple Pay ou Google Pay. Aucun compte AfriFlow n’est nécessaire de leur côté — ils ouvrent le lien et c’est payé.",
  },
  {
    q: "Mes données sont-elles protégées ?",
    a: "Oui. Tout est chiffré. Vos paiements passent par des partenaires certifiés et reconnus mondialement.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-primary text-primary-foreground font-bold shadow-glow">
              A
            </span>
            <span className="font-display text-lg font-bold tracking-tight">AfriFlow</span>
          </Link>
          <nav className="hidden gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how" className="transition-colors hover:text-foreground">Comment ça marche</a>
            <a href="#features" className="transition-colors hover:text-foreground">Fonctionnalités</a>
            <a href="#testimonials" className="transition-colors hover:text-foreground">Témoignages</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" search={{ mode: "signin" }}>
              <Button variant="ghost" size="sm">Se connecter</Button>
            </Link>
            <Link to="/auth" search={{ mode: "signup" }}>
              <Button size="sm" className="shadow-glow">Commencer gratuitement</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero">
        <div className="absolute inset-0 dot-bg pointer-events-none" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-16 md:grid-cols-[1.05fr_0.95fr] md:pt-24">
          <div className="relative z-10 animate-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-soft">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-pulse-ring" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Conçu avec ❤️ pour les freelances africains
            </div>
            <h1 className="mt-6 text-[2.5rem] font-bold leading-[1.05] tracking-tight md:text-6xl">
              Travaillez avec le monde entier.{" "}
              <span className="text-gradient-primary">Soyez payé chez vous.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Un numéro pro international, vos clients organisés, et vos paiements directement sur votre
              Mobile Money. Tout depuis un seul endroit, simple comme un message WhatsApp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button size="lg" className="shadow-glow">
                  Obtenir mon numéro <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#how">
                <Button size="lg" variant="outline">Voir comment ça marche</Button>
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Numéro offert</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> 10 minutes d’appel incluses</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-success" /> Sans carte bancaire</span>
            </div>
          </div>

          {/* Hero visual — illustrated UI mock, no stock images */}
          <div className="relative z-10 h-[480px] md:h-[560px]">
            {/* Main phone card */}
            <div className="absolute right-0 top-0 w-[78%] animate-float-slow">
              <div className="rounded-3xl border border-border bg-surface-elevated p-5 shadow-elevated">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-success" /> Numéro actif
                  </span>
                  <span>15:04</span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Votre ligne pro 🇫🇷</div>
                    <div className="font-display text-lg font-semibold tracking-tight">+33 1 76 36 04 88</div>
                  </div>
                </div>
                <div className="mt-5 space-y-2.5">
                  {[
                    { name: "Camille — Paris", t: "Il y a 2 min", paid: true },
                    { name: "Lukas — Berlin", t: "Hier", paid: false },
                    { name: "Marc — Montréal", t: "Lun.", paid: true },
                  ].map((c) => (
                    <div key={c.name} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-semibold">
                          {c.name[0]}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{c.name}</div>
                          <div className="text-xs text-muted-foreground">{c.t}</div>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.paid ? "bg-success/15 text-success" : "bg-sun/20 text-foreground/70"}`}>
                        {c.paid ? "Payé" : "En attente"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating payment received */}
            <div className="absolute -left-2 bottom-6 w-[60%] animate-float-slower">
              <div className="rounded-2xl border border-border bg-surface-elevated p-4 shadow-elevated">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success">
                    <Check className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Paiement reçu</div>
                    <div className="truncate text-xs text-muted-foreground">+ 25 000 FCFA · Orange Money</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Camille · Paris · Carte Visa
                </div>
              </div>
            </div>

            {/* Small flag chip */}
            <div className="absolute -right-2 bottom-2 rounded-2xl border border-border bg-surface-warm px-3 py-2 shadow-soft">
              <div className="flex items-center gap-2 text-xs font-medium">
                <span className="text-base">🇨🇦</span> Appel entrant · Montréal
              </div>
            </div>
          </div>
        </div>

        {/* Country marquee */}
        <div className="relative border-t border-border/60 bg-background/60 py-5">
          <div className="mx-auto max-w-6xl px-6">
            <p className="text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Recevez vos appels comme si vous étiez en
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {countries.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm font-medium shadow-soft"
                >
                  <span className="text-base">{c.flag}</span>
                  {c.label}
                  <span className="text-muted-foreground">{c.code}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works — Notion style: big, friendly, simple */}
      <section id="how" className="relative mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Comment ça marche</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            Trois étapes. C’est tout.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Pas de manuel. Pas d’installation compliquée. Vous démarrez en quelques minutes.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="group relative rounded-3xl border border-border bg-surface-elevated p-7 transition-all hover:-translate-y-1 hover:shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-sm font-bold text-background">
                  {s.n}
                </span>
                <div
                  className={`grid h-12 w-12 place-items-center rounded-2xl ${
                    s.accent === "primary"
                      ? "bg-primary/15 text-primary"
                      : s.accent === "teal"
                      ? "bg-teal/15 text-teal"
                      : "bg-sun/20 text-foreground"
                  }`}
                >
                  <s.icon className="h-6 w-6" />
                </div>
              </div>
              <h3 className="mt-6 text-xl font-bold tracking-tight">{s.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Big feature blocks — Notion-style two cards */}
      <section id="features" className="border-y border-border/60 bg-surface-warm/60">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">Tout au même endroit</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
              Votre activité internationale, simplifiée.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Un numéro pro. Vos clients organisés. Vos paiements reçus. Sans jargon, sans complications.
            </p>
          </div>

          {/* Two big feature cards */}
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {/* Numéro pro */}
            <div className="overflow-hidden rounded-3xl border border-border bg-surface-elevated shadow-card">
              <div className="p-8">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-primary">
                  <PhoneCall className="h-4 w-4" /> Numéro professionnel
                </div>
                <h3 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                  Recevez et passez des appels comme un local.
                </h3>
                <p className="mt-3 text-muted-foreground">
                  Choisissez un numéro en France, Belgique, Canada ou États-Unis. Vos clients vous appellent
                  sans frais — vous répondez depuis votre navigateur.
                </p>
              </div>
              <div className="mx-8 mb-8 rounded-2xl bg-gradient-to-br from-background to-surface-warm p-5">
                <div className="grid grid-cols-2 gap-3">
                  {countries.map((c) => (
                    <div key={c.label} className="flex items-center gap-2 rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm shadow-soft">
                      <span className="text-lg">{c.flag}</span>
                      <div className="min-w-0">
                        <div className="font-semibold">{c.label}</div>
                        <div className="text-xs text-muted-foreground">{c.code}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Paiements */}
            <div className="overflow-hidden rounded-3xl border border-border bg-surface-elevated shadow-card">
              <div className="p-8">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-teal">
                  <Wallet className="h-4 w-4" /> Paiements simplifiés
                </div>
                <h3 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                  Envoyez un lien. Soyez payé. C’est tout.
                </h3>
                <p className="mt-3 text-muted-foreground">
                  Créez un lien de paiement, partagez-le par WhatsApp ou email. Votre client paie par carte
                  et vous recevez l’argent sur votre Mobile Money.
                </p>
              </div>
              <div className="mx-8 mb-8 rounded-2xl bg-gradient-to-br from-background to-surface-warm p-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-3 py-2.5 shadow-soft">
                    <div className="flex items-center gap-2.5">
                      <Send className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Lien envoyé à Camille</span>
                    </div>
                    <span className="text-xs text-muted-foreground">11:02</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated px-3 py-2.5 shadow-soft">
                    <div className="flex items-center gap-2.5">
                      <Check className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium">Payé · 120 €</span>
                    </div>
                    <span className="text-xs text-muted-foreground">11:03</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border bg-success/10 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Wallet className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium">Sur votre Wave · 78 600 FCFA</span>
                    </div>
                    <span className="text-xs text-success">Demain</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Smaller benefits grid */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const tone =
                f.tone === "blue"
                  ? "bg-primary/12 text-primary"
                  : f.tone === "teal"
                  ? "bg-teal/15 text-teal"
                  : f.tone === "sun"
                  ? "bg-sun/25 text-foreground"
                  : f.tone === "rose"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-accent text-accent-foreground";
              return (
                <div
                  key={f.title}
                  className="group rounded-2xl border border-border bg-surface-elevated p-6 transition-all hover:-translate-y-1 hover:shadow-card"
                >
                  <div className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-bold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mobile Money trust section */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-teal">Mobile Money</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
              Votre argent arrive là où vous le dépensez déjà.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Plus besoin de compte bancaire à l’étranger ni de virement international. Choisissez votre
              opérateur et recevez vos paiements en monnaie locale, sous 1 à 2 jours.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {momoBrands.map((m) => (
                <span
                  key={m.name}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm font-semibold shadow-soft"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: m.color }}
                  />
                  {m.name}
                </span>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="rounded-3xl border border-border bg-gradient-warm p-8 shadow-card">
              <div className="rounded-2xl bg-surface-elevated p-6 shadow-soft">
                <div className="text-xs font-medium text-muted-foreground">Solde Mobile Money</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-bold tracking-tight">324 800</span>
                  <span className="text-sm font-semibold text-muted-foreground">FCFA</span>
                </div>
                <div className="mt-4 space-y-2.5">
                  {[
                    { who: "Camille — Paris", amt: "+ 78 600", note: "120 €" },
                    { who: "Lukas — Berlin", amt: "+ 49 000", note: "75 €" },
                    { who: "Marc — Montréal", amt: "+ 65 200", note: "130 CAD" },
                  ].map((r) => (
                    <div key={r.who} className="flex items-center justify-between rounded-xl bg-background px-3 py-2.5">
                      <div className="text-sm">
                        <div className="font-medium">{r.who}</div>
                        <div className="text-xs text-muted-foreground">{r.note}</div>
                      </div>
                      <span className="font-semibold text-success">{r.amt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -right-3 -top-3 rounded-2xl border border-border bg-surface-elevated px-3 py-2 text-xs font-medium shadow-elevated">
              💸 Reçu il y a 2 min
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="border-y border-border/60 bg-surface/60">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-primary">Ils l’utilisent déjà</p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
                Des freelances comme vous, partout en Afrique.
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-4 py-2 text-sm shadow-soft">
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-sun text-sun" />
                ))}
              </div>
              <span className="font-semibold">4,9 / 5</span>
              <span className="text-muted-foreground">· 1 200+ utilisateurs</span>
            </div>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="flex h-full flex-col justify-between rounded-3xl border border-border bg-surface-elevated p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-card"
              >
                <blockquote className="text-[15px] leading-relaxed text-foreground/90">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                  <img
                    src={t.avatar}
                    alt={t.name}
                    width={88}
                    height={88}
                    loading="lazy"
                    className="h-11 w-11 rounded-full object-cover"
                  />
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Trial banner */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-6 rounded-3xl border border-border bg-surface-warm p-8 shadow-soft md:grid-cols-3 md:p-10">
          {[
            { icon: Gift, title: "Votre numéro pro offert", desc: "Le numéro de votre choix, prêt en quelques minutes." },
            { icon: PhoneCall, title: "10 minutes d’appel incluses", desc: "Pour appeler vos premiers clients sans engagement." },
            { icon: Smile, title: "Sans carte bancaire", desc: "Aucune carte demandée. Vous explorez tout, librement." },
          ].map((b) => (
            <div key={b.title} className="flex gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-elevated text-primary shadow-soft">
                <b.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold tracking-tight">{b.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{b.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-y border-border/60 bg-surface/60">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">FAQ</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Les questions qu’on nous pose souvent.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Une autre question ?{" "}
              <a href="mailto:contact@afriflow.app" className="font-medium text-primary hover:underline">
                Écrivez-nous
              </a>
              , on répond sous 24 h.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`} className="border-border">
                <AccordionTrigger className="text-left text-base font-semibold hover:text-primary">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-hero p-10 text-center shadow-card md:p-16">
          <div className="absolute inset-0 dot-bg opacity-50" />
          <div className="relative">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-sun" /> Sans carte bancaire
            </div>
            <h2 className="mt-6 text-4xl font-bold tracking-tight md:text-5xl">
              Prêt à travailler comme un{" "}
              <span className="text-gradient-primary">pro international ?</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
              Obtenez votre numéro pro et vos 10 minutes d’appel offertes. Commencez aujourd’hui — vous
              recevrez vos premiers paiements sur Mobile Money.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/auth" search={{ mode: "signup" }}>
                <Button size="lg" className="shadow-glow">
                  Créer mon compte <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth" search={{ mode: "signin" }}>
                <Button size="lg" variant="outline">J’ai déjà un compte</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-gradient-primary text-primary-foreground text-xs font-bold">
              A
            </span>
            <span>© {new Date().getFullYear()} AfriFlow · Fait avec <Heart className="inline h-3 w-3 fill-destructive text-destructive" /> pour les freelances africains</span>
          </div>
          <div className="flex gap-6">
            <a href="#features" className="hover:text-foreground">Fonctionnalités</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
            <a href="mailto:contact@afriflow.app" className="hover:text-foreground">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
