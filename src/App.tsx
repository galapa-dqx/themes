import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Loader,
  Kbd,
  Menu,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconCheck,
  IconChevronDown,
  IconComponents,
  IconCopy,
  IconEye,
  IconFileExport,
  IconFileImport,
  IconFolder,
  IconFolderOpen,
  IconPalette,
  IconPencil,
  IconPlus,
  IconSettings,
} from '@tabler/icons-react';
import { useAppStore } from '@/editor/appStore';
import { newProjectId } from '@/editor/projectStore';
import { ProjectStoreProvider, useProjectStore } from '@/editor/projectStore';
import { useProject } from '@/editor/useProject';

const SECTIONS = [
  { id: 'project', label: 'Project', icon: IconFolder },
  { id: 'tokens', label: 'Tokens', icon: IconPalette },
  { id: 'controls', label: 'Controls', icon: IconComponents },
  { id: 'preview', label: 'Preview', icon: IconEye },
] as const;

// ponytail: swatch is a placeholder until themes carry an accent color.
const SWATCH = '#e0114a';

const Slash = () => (
  <Text c="gray.4" component="span">
    /
  </Text>
);

function ThemeMenu() {
  const name = useProjectStore((s) => s.doc.metadata.name);
  const id = useProjectStore((s) => s.doc.metadata.id);
  const recent = useAppStore((s) => s.recent);
  return (
    <Menu width={260} position="bottom-start" shadow="md" offset={6}>
      <Menu.Target>
        <UnstyledButton
          fw={600}
          px={8}
          py={4}
          mx={-8}
          style={{
            borderRadius: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {name}
          <IconChevronDown size={14} color="var(--mantine-color-dimmed)" />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconPencil size={16} />}>
          Rename theme…
        </Menu.Item>
        <Menu.Item leftSection={<IconCopy size={16} />}>
          Duplicate theme
        </Menu.Item>
        <Menu.Item
          leftSection={<IconFileExport size={16} />}
          rightSection={<Kbd>⌘ E</Kbd>}
        >
          Export .galtheme
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconFolderOpen size={16} />}
          rightSection={<Kbd>⌘ O</Kbd>}
        >
          Open theme…
        </Menu.Item>
        <Menu.Item leftSection={<IconFileImport size={16} />}>
          Import .galtheme…
        </Menu.Item>
        <Menu.Label>Recent</Menu.Label>
        {recent.map((t) => (
          <Menu.Item
            key={t.id}
            component={Link}
            to={`/editor/${t.id}/controls`}
            leftSection={
              <Box
                w={14}
                h={14}
                bg={SWATCH}
                style={{
                  borderRadius: 3,
                  border: '1px solid var(--mantine-color-gray-3)',
                }}
              />
            }
            rightSection={
              t.id === id ? (
                <IconCheck size={16} color="var(--mantine-color-blue-6)" />
              ) : null
            }
          >
            {t.name}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item leftSection={<IconPlus size={16} />}>New theme</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** Resumes the most recent project, or starts a blank one. ponytail: becomes a picker. */
export function EditorIndex() {
  const latest = useAppStore((s) => s.recent[0]);
  const to = latest
    ? `/editor/${latest.id}/controls`
    : `/editor/${newProjectId()}/project`;
  return <Navigate to={to} replace />;
}

export default function App() {
  const { id: themeId = '', section } = useParams();
  const project = useProject(themeId);
  const name =
    project.status === 'open'
      ? project.store.getState().doc.metadata.name
      : undefined;
  const touchRecent = useAppStore((s) => s.touchRecent);
  useEffect(() => {
    if (name !== undefined) touchRecent({ id: themeId, name });
  }, [themeId, name, touchRecent]);

  const current = SECTIONS.find((s) => s.id === section);
  if (!current) return <Navigate to={`/editor/${themeId}/controls`} replace />;
  if (project.status === 'loading')
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  if (project.status === 'error')
    return (
      <Center h="100vh" p="xl">
        <Alert color="red" title="Could not open this project" maw={520}>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {project.message}
          </pre>
        </Alert>
      </Center>
    );
  return (
    <ProjectStoreProvider value={project.store}>
      <Shell themeId={themeId} current={current} />
    </ProjectStoreProvider>
  );
}

function Shell({
  themeId,
  current,
}: {
  themeId: string;
  current: (typeof SECTIONS)[number];
}) {
  const saving = useProjectStore((s) => s.saving);
  return (
    <AppShell header={{ height: 52 }} navbar={{ width: 56, breakpoint: 0 }}>
      <AppShell.Header>
        <Group
          h="100%"
          px={16}
          gap={12}
          wrap="nowrap"
          style={{ whiteSpace: 'nowrap' }}
        >
          <Text fw={700} c="blue.6" fz={16}>
            Galapa Theme Studio
          </Text>
          <Slash />
          <ThemeMenu />
          {saving && <Loader size={12} color="gray" aria-label="Saving" />}
          <Slash />
          <Text c="dimmed">{current.label}</Text>
          <Badge color="gray" variant="light" size="sm">
            saved 2m ago
          </Badge>
          <Box flex={1} />
          <Button variant="default" size="xs">
            Import sprites
          </Button>
          <Button size="xs">Export theme</Button>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="10px 8px">
        <Stack align="center" gap={6} h="100%">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <Tooltip key={id} label={label} position="bottom">
              <ActionIcon
                size="lg"
                variant={id === current.id ? 'light' : 'subtle'}
                color={id === current.id ? 'blue' : 'gray'}
                aria-label={label}
                aria-current={id === current.id ? 'page' : undefined}
                component={Link}
                to={`/editor/${themeId}/${id}`}
              >
                <Icon size={20} />
              </ActionIcon>
            </Tooltip>
          ))}
          <Box flex={1} />
          <ActionIcon
            size="lg"
            variant="subtle"
            color="gray"
            aria-label="Settings"
          >
            <IconSettings size={20} />
          </ActionIcon>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0" />
    </AppShell>
  );
}
