import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Facebook, Instagram, Mail, MapPin, Music2, Phone, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(2, "Name is too short"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(5, "Subject is too short"),
  message: z.string().min(10, "Message is too short"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactInfoProps {
  showMap?: boolean;
}

export default function ContactInfo({ showMap = true }: ContactInfoProps) {
  const { toast } = useToast();

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

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 max-w-6xl py-24 md:py-32">
        {/* Section Header */}
        <div className="text-center mb-16 md:mb-20">
          <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground font-semibold mb-4">
            Contact
          </p>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black uppercase tracking-tight">
            Get in Touch
          </h2>
          <div className="mt-6 w-16 h-0.5 bg-muted-foreground/30 mx-auto rounded-full" />
        </div>

        {/* Content */}
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
          {/* Contact Information */}
          <div className="space-y-10">
            <p className="text-muted-foreground text-sm leading-relaxed">
              Have a question about an order or just want to say hi? Our team is here to help.
            </p>

            <div className="space-y-8">
              {/* Email */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--accent-text)] shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                    Email Us
                  </p>
                  <p className="text-sm leading-relaxed">rarenepal999@gmail.com</p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--accent-text)] shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                    Our Atelier
                  </p>
                  <p className="text-sm leading-relaxed">
                    Khusibu, Nayabazar
                    <br />
                    Kathmandu, Nepal
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--accent-text)] shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                    Call Us
                  </p>
                  <p className="text-sm leading-relaxed">(+977)-9705208960</p>

                  <div className="flex gap-3 mt-4">
                    <a
                      href="https://www.facebook.com/rarenp"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full border border-border hover:bg-muted transition-colors"
                      aria-label="Facebook"
                    >
                      <Facebook className="w-4 h-4" />
                    </a>
                    <a
                      href="https://www.instagram.com/rareofficial.au/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full border border-border hover:bg-muted transition-colors"
                      aria-label="Instagram"
                    >
                      <Instagram className="w-4 h-4" />
                    </a>
                    <a
                      href="https://www.tiktok.com/@rare.np"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full border border-border hover:bg-muted transition-colors"
                      aria-label="TikTok"
                    >
                      <Music2 className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Map */}
            {showMap && (
              <div className="rounded-2xl overflow-hidden border border-border shadow-sm h-[220px] w-full">
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
            )}
          </div>

          {/* Contact Form */}
          <div className="bg-card border border-border p-8 md:p-10 rounded-2xl shadow-sm self-start">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                    Name
                  </label>
                  <Input
                    {...form.register("name")}
                    placeholder="Your Name"
                    className="bg-background border-border rounded-xl h-12"
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
                    className="bg-background border-border rounded-xl h-12"
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
                  className="bg-background border-border rounded-xl h-12"
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
                  className="bg-background border-border rounded-xl min-h-[150px] resize-none"
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
                {mutation.isPending ? "Sending..." : (
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    <span>Send Message</span>
                  </div>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
