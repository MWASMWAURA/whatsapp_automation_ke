import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import UseCases from "@/components/UseCases";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <section id="features">
        <Features />
      </section>
      <section id="use-cases">
        <UseCases />
      </section>
      <Testimonials />
      <section id="pricing">
        <Pricing />
      </section>
      <Footer />
    </main>
  );
}
