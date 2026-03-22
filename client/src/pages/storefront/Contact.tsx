import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Facebook, Instagram, Mail, MapPin, Music2, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useForm } from "react-hook-form";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(5, "Subject is too short"),
  message: z.string().min(10, "Message is too short"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export default function Contact() {
  const { toast } = useToast();
  const conceptSectionRef = useRef<HTMLElement | null>(null);
  const [isConceptVisible, setIsConceptVisible] = useState(false);

  const mutation = useMutation({
    mutationFn: async (data: ContactFormValues) => {
      const res = await apiRequest("POST", "/api/contact", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "Thank you for reaching out. We'll get back to you soon.",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const onSubmit = (data: ContactFormValues) => {
    mutation.mutate(data);
  };

  useEffect(() => {
    const node = conceptSectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsConceptVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scrollToContact = () => {
      if (window.location.hash !== "#contact") return;
      const el = document.getElementById("contact");
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    };
    scrollToContact();
    window.addEventListener("hashchange", scrollToContact);
    return () => window.removeEventListener("hashchange", scrollToContact);
  }, []);

  return (
    <div className="flex-1">
      <Helmet>
        <title>ATELIER | Rare Atelier</title>
      </Helmet>

      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/images/about.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            animation: "atelier-ken-burns 28s ease-in-out infinite alternate",
          }}
        />
        <div className="absolute inset-0 bg-black/45 dark:bg-black/60" />
        <div className="relative container mx-auto px-4 py-28 md:py-40 max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/75 font-semibold mb-5">
              About Us
            </p>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white uppercase">
              Rare.NP
            </h1>
            <p className="mt-6 text-sm md:text-base text-white/90 leading-relaxed">
              Rare.NP is a luxury streetwear label from Nepal, crafting limited pieces that fuse
              Himalayan identity with contemporary street culture. Our garments are cut with intent,
              built in small runs, and designed to carry both altitude and attitude.
            </p>
          </div>
        </div>
      </section>

      <section
        ref={conceptSectionRef}
        className="py-20 md:py-24 bg-[var(--bg-secondary)] border-b border-[var(--border)]"
      >
        <div
          className={`container mx-auto px-4 max-w-6xl transition-all duration-700 ${
            isConceptVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
              <img
                src="/images/concept.webp"
                alt="Rare.NP concept visual"
                className="w-full h-[300px] md:h-[420px] object-cover"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-semibold mb-5">
                The Concept
              </p>
              <h2 className="text-3xl md:text-5xl font-black tracking-tight uppercase mb-6">
                Himalayan Code, Global Street
              </h2>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                Rare.NP exists at the intersection of Himalayan culture and global streetwear,
                translating local memory into a modern silhouette. Every release is treated as a
                limited object rather than a product, created for those who collect meaning as much
                as design.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="py-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-16">
            <div className="space-y-12">
              <div className="space-y-4">
                <h2 className="text-3xl font-black uppercase tracking-tighter">Get in Touch</h2>
                <p className="text-muted-foreground text-sm font-mono">
                  Have a question about an order or just want to say hi? Our team is here to help.
                </p>
              </div>

              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--accent-text)]">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                      Email Us
                    </p>
                    <p className="text-sm font-mono leading-relaxed">rarenepal999@gmail.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--accent-text)]">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                      Our Atelier
                    </p>
                    <p className="text-sm font-mono leading-relaxed">
                      Khusibu, Nayabazar
                      <br />
                      Kathmandu, Nepal
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--accent-text)]">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                      Call Us
                    </p>
                    <p className="text-sm font-mono leading-relaxed">(+977)-9705208960</p>

                    <div className="flex gap-4 mt-4">
                      <a
                        href="https://www.facebook.com/rarenp"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-full border border-[var(--border)] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Facebook className="w-4 h-4" />
                      </a>
                      <a
                        href="https://www.instagram.com/rare.np/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-full border border-[var(--border)] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Instagram className="w-4 h-4" />
                      </a>
                      <a
                        href="https://www.tiktok.com/@rare.np"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-full border border-[var(--border)] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Music2 className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-8 rounded-2xl overflow-hidden border border-[var(--border)] shadow-sm h-[250px]">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3531.8123!2d85.3094!3d27.7214!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39eb18fc!2sKhusibu%2C%20Kathmandu!5e0!3m2!1sen!2snp!4v1710100000000!5m2!1sen!2snp"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    title="Rare Atelier Location"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[var(--bg-card)] border border-[var(--border)] p-8 md:p-10 rounded-2xl shadow-sm">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                      Name
                    </label>
                    <Input
                      {...form.register("name")}
                      placeholder="Your Name"
                      className="bg-background/50 border-[var(--border)] rounded-xl h-12"
                    />
                    {form.formState.errors.name && (
                      <p className="text-[10px] text-red-500 uppercase">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                      Email
                    </label>
                    <Input
                      {...form.register("email")}
                      placeholder="Your Email"
                      className="bg-background/50 border-[var(--border)] rounded-xl h-12"
                    />
                    {form.formState.errors.email && (
                      <p className="text-[10px] text-red-500 uppercase">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                    Subject
                  </label>
                  <Input
                    {...form.register("subject")}
                    placeholder="How can we help?"
                    className="bg-background/50 border-[var(--border)] rounded-xl h-12"
                  />
                  {form.formState.errors.subject && (
                    <p className="text-[10px] text-red-500 uppercase">
                      {form.formState.errors.subject.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                    Message
                  </label>
                  <Textarea
                    {...form.register("message")}
                    placeholder="Tell us more..."
                    className="bg-background/50 border-[var(--border)] rounded-xl min-h-[150px] resize-none"
                  />
                  {form.formState.errors.message && (
                    <p className="text-[10px] text-red-500 uppercase">
                      {form.formState.errors.message.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="w-full h-14 bg-black dark:bg-white text-white dark:text-black hover:opacity-90 rounded-xl uppercase tracking-[0.3em] font-bold transition-all disabled:opacity-50"
                >
                  {mutation.isPending ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes atelier-ken-burns {
          0% { transform: scale(1.02) translate3d(0, 0, 0); }
          50% { transform: scale(1.08) translate3d(-1.5%, -1.5%, 0); }
          100% { transform: scale(1.12) translate3d(1.5%, 1%, 0); }
        }
      `}</style>
    </div>
  );
}
