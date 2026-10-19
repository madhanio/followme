import { Hero } from '@/components/Hero';
import { BlurInHeadline } from '@/components/BlurInHeadline';
import { FeaturesBento } from '@/components/FeaturesBento';
import { Testimonials } from '@/components/Testimonials';
import { HowItWorks } from '@/components/HowItWorks';
import { FAQ } from '@/components/FAQ';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Hero with 3D Parallax Tilt, Staggered Text, Dashboard Image, and Infinite Ticker */}
      <Hero />

      {/* 2. Philosophy Scroll Unblur Section */}
      <BlurInHeadline />

      {/* 3. Bento Grid with Device Mockups & Live Radar Ripple */}
      <FeaturesBento />

      {/* 4. Interactive Testimonials Carousel with SVG Circular Timer Ring */}
      <Testimonials />

      {/* 5. Interactive Scroll-Linked Progress Line */}
      <HowItWorks />

      {/* 6. Interactive Accordion FAQs */}
      <FAQ />
    </div>
  );
}
