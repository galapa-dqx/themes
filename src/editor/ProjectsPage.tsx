/**
 * 5a: the project list at /editor. Your themes (OPFS folders) open directly;
 * the Galapa collection is bundled, locked, and duplicated to edit.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ActionIcon,
  AppShell,
  Box,
  Button,
  Group,
  Loader,
  Menu,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconCopy,
  IconDots,
  IconLock,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useAppStore } from './appStore';
import {
  ago,
  deleteProject,
  duplicateFolder,
  duplicateFirstParty,
  FIRST_PARTY,
  listProjects,
  renameProject,
  type FirstPartyTheme,
  type ProjectCard,
} from './projectList';
import { newProjectId } from './projectStore';
import { runtime } from './runtime';

const GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 16,
} as const;

export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectCard[]>();
  const [query, setQuery] = useState('');
  const reload = () => runtime.runPromise(listProjects).then(setProjects);
  useEffect(() => void reload(), []);
  const q = query.trim().toLowerCase();
  const match = (name: string) => !q || name.toLowerCase().includes(q);
  const mine = projects?.filter((p) => match(p.metadata.name));
  const collection = FIRST_PARTY.filter((t) => match(t.doc.metadata.name));

  return (
    <AppShell header={{ height: 52 }}>
      <AppShell.Header>
        <Group h="100%" px={16} gap={12} wrap="nowrap">
          <Text fw={700} c="blue.6" fz={16}>
            Galapa Theme Studio
          </Text>
          <Text c="gray.4">/</Text>
          <Text c="dimmed">Projects</Text>
          <Box flex={1} />
          {/* ponytail: enabled once .galtheme packaging exists. */}
          <Button variant="default" size="xs" disabled>
            Import .galtheme
          </Button>
        </Group>
      </AppShell.Header>
      <AppShell.Main bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
        <Stack gap={36} p="28px 40px 120px">
          <Stack gap={14}>
            <Group gap={10} align="baseline">
              <Title order={2} fz={20}>
                Your themes
              </Title>
              <Text c="dimmed" fz={13}>
                {projects?.length ?? ''}
              </Text>
              <Box flex={1} />
              <TextInput
                size="xs"
                w={220}
                placeholder="Search themes"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
              />
            </Group>
            {mine ? (
              <div style={GRID}>
                {mine.map((p) => (
                  <MineCard key={p.id} card={p} reload={reload} />
                ))}
                {!q && <NewCard />}
              </div>
            ) : (
              <Loader size="sm" />
            )}
          </Stack>
          <Stack gap={14}>
            <Group gap={10} align="baseline">
              <Title order={2} fz={20}>
                Galapa collection
              </Title>
              <Text c="dimmed" fz={13}>
                First-party themes · read-only · duplicate to edit
              </Text>
            </Group>
            <div style={GRID}>
              {collection.map((t) => (
                <CollectionCard key={t.key} theme={t} />
              ))}
            </div>
          </Stack>
        </Stack>
      </AppShell.Main>
    </AppShell>
  );
}

function Cover({ src }: { src: string | undefined }) {
  return (
    <div
      style={{
        aspectRatio: '4 / 3',
        borderBottom: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-gray-1)',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--mantine-color-dimmed)',
        fontSize: 12,
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        'No cover'
      )}
    </div>
  );
}

function Card({
  cover,
  title,
  subtitle,
  locked,
  menu,
  onOpen,
}: {
  cover: string | undefined;
  title: React.ReactNode;
  subtitle: string;
  locked?: boolean;
  menu: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <div
      style={{
        background: 'var(--mantine-color-body)',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 'var(--mantine-radius-md)',
        overflow: 'hidden',
        boxShadow: 'var(--mantine-shadow-xs)',
      }}
    >
      <UnstyledButton
        onClick={onOpen}
        display="block"
        w="100%"
        style={{ cursor: onOpen ? 'pointer' : 'default' }}
      >
        <Cover src={cover} />
      </UnstyledButton>
      <Stack gap={2} p="10px 12px 12px">
        <Group gap={6} wrap="nowrap">
          {locked && <IconLock size={14} color="var(--mantine-color-dimmed)" />}
          <Text fw={600} truncate flex={1} miw={0}>
            {title}
          </Text>
          <Menu
            width={248}
            position="bottom-end"
            shadow="md"
            returnFocus={false}
          >
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm">
                <IconDots size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>{menu}</Menu.Dropdown>
          </Menu>
        </Group>
        <Text fz={12} c="dimmed">
          {subtitle}
        </Text>
      </Stack>
    </div>
  );
}

function MineCard({
  card,
  reload,
}: {
  card: ProjectCard;
  reload: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const forgetRecent = useAppStore((s) => s.forgetRecent);
  const [renaming, setRenaming] = useState(false);
  const open = () => navigate(`/editor/${card.id}/project`);
  const commit = (value: string) => {
    setRenaming(false);
    const name = value.trim();
    if (name && name !== card.metadata.name)
      runtime.runPromise(renameProject(card, name)).then(reload);
  };
  return (
    <Card
      cover={card.cover}
      onOpen={open}
      title={
        renaming ? (
          <TextInput
            size="xs"
            defaultValue={card.metadata.name}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onBlur={(e) => commit(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit(e.currentTarget.value);
              if (e.key === 'Escape') setRenaming(false);
            }}
          />
        ) : (
          card.metadata.name
        )
      }
      subtitle={`${card.editedAt ? `Edited ${ago(card.editedAt)}` : 'Unsaved'} · ${card.controls} ${card.controls === 1 ? 'control' : 'controls'}`}
      menu={
        <>
          <Menu.Item
            leftSection={<IconPencil size={16} />}
            onClick={() => setRenaming(true)}
          >
            Rename…
          </Menu.Item>
          <Menu.Item
            leftSection={<IconCopy size={16} />}
            onClick={() =>
              runtime.runPromise(duplicateFolder(card)).then(reload)
            }
          >
            Duplicate
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() => {
              // ponytail: native confirm; a modal if this ever needs polish.
              if (
                !confirm(
                  `Delete "${card.metadata.name}"? This cannot be undone.`,
                )
              )
                return;
              runtime
                .runPromise(deleteProject(card.id))
                .then(() => forgetRecent(card.id))
                .then(reload);
            }}
          >
            Delete
          </Menu.Item>
        </>
      }
    />
  );
}

function CollectionCard({ theme }: { theme: FirstPartyTheme }) {
  const navigate = useNavigate();
  const duplicate = () =>
    runtime
      .runPromise(duplicateFirstParty(theme))
      .then((id) => navigate(`/editor/${id}/project`));
  return (
    <Card
      cover={theme.cover}
      locked
      onOpen={duplicate}
      title={theme.doc.metadata.name}
      subtitle={theme.doc.metadata.description ?? 'Ships with Galapa'}
      menu={
        <>
          <Menu.Item leftSection={<IconCopy size={16} />} onClick={duplicate}>
            Duplicate to your themes
          </Menu.Item>
          <Menu.Divider />
          <Text fz={12} c="dimmed" p="6px 10px 8px" lh={1.45}>
            Part of the Galapa collection. Rename and Delete are available on
            your copy.
          </Text>
        </>
      }
    />
  );
}

function NewCard() {
  return (
    <UnstyledButton
      component={Link}
      to={`/editor/${newProjectId()}/project`}
      style={{
        border: '1px dashed var(--mantine-color-gray-4)',
        borderRadius: 'var(--mantine-radius-md)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        color: 'var(--mantine-color-dimmed)',
        minHeight: 100,
      }}
    >
      <IconPlus size={22} />
      <Text fw={600} fz={13}>
        New theme
      </Text>
      <Text fz={12}>Blank, or duplicate one below</Text>
    </UnstyledButton>
  );
}
