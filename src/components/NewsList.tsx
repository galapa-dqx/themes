import { CategoryShape, type NewsCategory } from './icons';
import styles from './NewsList.module.css';

export type NewsEntry = {
  id: string;
  category: NewsCategory;
  title: string;
  date: string;
};

export default function NewsList({ items }: { items: NewsEntry[] }) {
  return (
    <ul className={styles.NewsList}>
      {items.map((item) => (
        <li key={item.id}>
          <a
            href="#"
            className={styles.NewsItem}
            onClick={(e) => e.preventDefault()}
          >
            <span className={styles.Badge}>
              <CategoryShape category={item.category} />
            </span>
            <span className={styles.Title}>{item.title}</span>
            <time className={styles.Date}>{item.date}</time>
          </a>
        </li>
      ))}
    </ul>
  );
}
