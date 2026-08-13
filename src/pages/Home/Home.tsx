import { useState } from 'react';
import Button from '@/components/Button';
import Carousel, { type CarouselSlide } from '@/components/Carousel';
import NewsList, { type NewsEntry } from '@/components/NewsList';
import PlayOrnament from '@/components/PlayOrnament';
import ScrollPanel from '@/components/ScrollPanel';
import Skin from '@/components/Skin';
import TextInput from '@/components/TextInput';
import styles from './Home.module.css';

const SLIDES: CarouselSlide[] = [
  {
    src: '/banners/dqx-shop.jpg',
    alt: 'DQX Shop — July 24 (Fri) 11:00 update. New items added!',
  },
  {
    src: '/banners/version-update.svg',
    alt: 'Version 7.4 — The Sable Depths. New zones, new bosses.',
  },
  {
    src: '/banners/anniversary.svg',
    alt: 'Astoltia 14th Anniversary — login bonuses all week long.',
  },
];

const NEWS: NewsEntry[] = [
  {
    id: 'birthday-tool',
    category: 'events',
    title:
      '[Super Convenient Tool] Astoltia Birthday Celebration: Summer Special Campaign 2026',
    date: 'Aug 1',
  },
  {
    id: 'drackyma',
    category: 'events',
    title: "Chatty Drackyma's Astoltia 14th Anniversary Countdown!",
    date: 'Jul 31',
  },
  {
    id: 'grand-thanks',
    category: 'updates',
    title: '[DQX Shop] 14th Anniversary Grand Thanksgiving!',
    date: 'July 30',
  },
  {
    id: 'payment',
    category: 'maintenance',
    title: 'Notice Regarding d Payment Service Restoration (7/30)',
    date: 'July 29',
  },
  {
    id: 'dqxtv',
    category: 'news',
    title:
      '[DQXTV] Notice Regarding the Postponement of the "Super Dragon Quest X TV 14th Anniversary Eve Festival"',
    date: 'July 28',
  },
  {
    id: 'handy-tool',
    category: 'updates',
    title: "[iOS] Dragon Quest X Adventurer's Handy Tool (Ver. 8.0.1)",
    date: 'July 27',
  },
  {
    id: 'scoop-off',
    category: 'events',
    title: 'Super Summer Scoop-Off! Screenshot Contest Now Open',
    date: 'July 26',
  },
  {
    id: 'maintenance-0725',
    category: 'maintenance',
    title: 'Scheduled Maintenance Completion Notice (7/25)',
    date: 'July 25',
  },
];

export default function Home() {
  const [username, setUsername] = useState('anlucialuvr69');
  const [password, setPassword] = useState('hunter2hunter');

  return (
    <div className={styles.Launcher}>
      <div className={styles.CarouselArea}>
        <Carousel slides={SLIDES} />
      </div>
      <section className={styles.News} aria-label="News">
        <ScrollPanel fade bleedLeft={8}>
          <NewsList items={NEWS} />
        </ScrollPanel>
      </section>
      <Skin
        part="panel"
        className={styles.LoginPanel}
        role="complementary"
        aria-label="Sign in"
      >
        <TextInput label="Username" value={username} onChange={setUsername} />
        <TextInput
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
        />
        <div className={styles.PlayRow}>
          <PlayOrnament />
          <Button>Play</Button>
          <PlayOrnament flip />
        </div>
      </Skin>
    </div>
  );
}
