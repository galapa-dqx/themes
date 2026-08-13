import { useState } from 'react';
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
      <figure className={styles.Frame}>
        <img
          className={styles.Banner}
          src={slides[index].src}
          alt={slides[index].alt}
        />
        <button
          type="button"
          className={`${styles.Nav} ${styles.NavPrev}`}
          aria-label="Previous banner"
          onClick={() => step(-1)}
        >
          <IconChevronRight width={28} height={28} className={styles.Flip} />
        </button>
        <button
          type="button"
          className={`${styles.Nav} ${styles.NavNext}`}
          aria-label="Next banner"
          onClick={() => step(1)}
        >
          <IconChevronRight width={28} height={28} />
        </button>
      </figure>
      <div className={styles.Pips}>
        {slides.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            className={styles.Pip}
            data-active={i === index || undefined}
            aria-label={`Go to banner ${i + 1} of ${slides.length}`}
            aria-current={i === index}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
}
