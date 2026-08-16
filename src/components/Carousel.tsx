import { useState } from 'react';
import Themed from './Themed';
import ThemedArt from './ThemedArt';
import { IconChevronRight } from './icons';
import styles from './Carousel.module.css';

export type CarouselSlide = {
  src: string;
  alt: string;
};

export default function Carousel({ slides }: { slides: CarouselSlide[] }) {
  const [index, setIndex] = useState(0);
  const step = (delta: number) =>
    setIndex((i) => (i + delta + slides.length) % slides.length);

  return (
    <section className={styles.Carousel} aria-label="Featured banners">
      <Themed as="figure" part="carousel" className={styles.Frame}>
        <img
          className={styles.Banner}
          src={slides[index].src}
          alt={slides[index].alt}
        />
        <Themed
          as="button"
          part="carousel.nav"
          type="button"
          className={`${styles.Nav} ${styles.NavPrev}`}
          aria-label="Previous banner"
          onClick={() => step(-1)}
        >
          <ThemedArt
            part="carousel.nav"
            className={styles.Flip}
            fallback={<IconChevronRight width={28} height={28} className={styles.Flip} />}
          />
        </Themed>
        <Themed
          as="button"
          part="carousel.nav"
          type="button"
          className={`${styles.Nav} ${styles.NavNext}`}
          aria-label="Next banner"
          onClick={() => step(1)}
        >
          <ThemedArt
            part="carousel.nav"
            fallback={<IconChevronRight width={28} height={28} />}
          />
        </Themed>
      </Themed>
      <div className={styles.Pips}>
        {slides.map((slide, i) => (
          <Themed
            key={slide.src}
            as="button"
            part="pip"
            state={i === index ? 'selected' : undefined}
            type="button"
            className={styles.Pip}
            aria-label={`Go to banner ${i + 1} of ${slides.length}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
          >
            <ThemedArt
              part="pip"
              state={i === index ? 'selected' : undefined}
              className={styles.PipArt}
            />
          </Themed>
        ))}
      </div>
    </section>
  );
}
