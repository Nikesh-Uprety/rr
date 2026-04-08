import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Box,
  CreditCard,
  Globe2,
  Receipt,
  RefreshCcw,
  ShoppingBag,
} from "lucide-react";

type FaqItem = {
  title: string;
  content: string;
};

const DEFAULT_FAQ_ITEMS: FaqItem[] = [
  {
    title: "How do I place an order?",
    content:
      "Browse products, add them to your cart, and complete checkout with shipping and payment details.",
  },
  {
    title: "Can I modify or cancel my order?",
    content:
      "Yes, eligible recent orders can be cancelled from your customer-side recent order actions before shipping. Once an order has been processed for dispatch or already shipped, modification and cancellation are no longer available.",
  },
  {
    title: "What payment methods do you accept?",
    content:
      "We currently support online payment options shown at checkout, plus verified payment channels configured by Rare Atelier.",
  },
  {
    title: "How much does shipping cost?",
    content:
      "Shipping charges depend on destination and order size. Final shipping cost appears at checkout before payment.",
  },
  {
    title: "Do you ship internationally?",
    content:
      "International availability depends on destination. Contact support for current delivery options and estimated timelines.",
  },
  {
    title: "How do I request a refund?",
    content:
      "If your order qualifies under our policy, contact support with your order number and we’ll guide you through the process.",
  },
];

const FAQ_ICONS = [ShoppingBag, Receipt, CreditCard, Box, Globe2, RefreshCcw] as const;

interface FaqSectionProps {
  config?: Record<string, unknown> | null;
}

function getFaqItems(config?: Record<string, unknown> | null): FaqItem[] {
  const raw = config?.items;
  if (!Array.isArray(raw)) return DEFAULT_FAQ_ITEMS;
  const parsed = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const title = typeof entry.title === "string" ? entry.title.trim() : "";
      const content = typeof entry.content === "string" ? entry.content.trim() : "";
      if (!title || !content) return null;
      return { title, content };
    })
    .filter((item): item is FaqItem => Boolean(item));
  return parsed.length ? parsed : DEFAULT_FAQ_ITEMS;
}

export default function FaqSection({ config }: FaqSectionProps) {
  const heading =
    typeof config?.title === "string" && config.title.trim()
      ? config.title.trim()
      : "Frequently Asked Questions";
  const subheading =
    typeof config?.text === "string" && config.text.trim()
      ? config.text.trim()
      : "Everything you need to know before placing your order.";
  const items = getFaqItems(config);

  return (
    <section className="border-t border-border/60 bg-background py-14 md:py-18" data-testid="home-faq-section">
      <div className="container mx-auto max-w-5xl px-4">
        <div className="mb-8 text-center">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
            Support
          </p>
          <h2 className="text-3xl font-black uppercase tracking-tight md:text-4xl">{heading}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">{subheading}</p>
        </div>

        <Accordion type="single" collapsible className="w-full rounded-2xl border border-border bg-card/70 p-2">
          {items.map((item, index) => {
            const Icon = FAQ_ICONS[index % FAQ_ICONS.length];
            return (
              <AccordionItem key={`${item.title}-${index}`} value={`faq-${index}`} className="border-border/70 px-2">
                <AccordionTrigger className="rounded-xl px-2 py-4 text-left text-sm font-semibold hover:no-underline">
                  <span className="mr-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex-1 pr-2">{item.title}</span>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pl-11 pr-2 text-sm leading-relaxed text-muted-foreground">
                  {item.content}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </section>
  );
}
