import { useEffect, useReducer, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
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
  TextInput,
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
  IconFile,
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
import { duplicateProject } from '@/editor/persistence';
import { ago } from '@/editor/projectList';
import { newProjectId, useProjectStoreApi } from '@/editor/projectStore';
import { ControlsPage } from '@/editor/ControlsPage';
import { PreviewPage } from '@/editor/PreviewPage';
import { ProjectPage } from '@/editor/ProjectPage';
import { SettingsPage } from '@/editor/SettingsPage';
import { TokensPage } from '@/editor/TokensPage';
import { runtime } from '@/editor/runtime';
import { ProjectStoreProvider, useProjectStore } from '@/editor/projectStore';
import { useProject, type ProjectState } from '@/editor/useProject';

const SECTIONS = [
  { id: 'project', label: 'Project', icon: IconFolder },
  { id: 'tokens', label: 'Tokens', icon: IconPalette },
  { id: 'controls', label: 'Controls', icon: IconComponents },
  { id: 'preview', label: 'Preview', icon: IconEye },
] as const;

const Slash = () => (
  <Text c="gray.4" component="span">
    /
  </Text>
);

function SaveBadge() {
  const saving = useProjectStore((s) => s.saving);
  const savedAt = useProjectStore((s) => s.savedAt);
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <Badge
      color="gray"
      variant="light"
      size="sm"
      leftSection={saving ? <Loader size={8} color="gray" /> : undefined}
    >
      {saving ? 'Saving…' : savedAt ? `Saved ${ago(savedAt)}` : 'Unsaved'}
    </Badge>
  );
}

function ThemeMenu({ themeId }: { themeId: string }) {
  const name = useProjectStore((s) => s.doc.metadata.name);
  const edit = useProjectStore((s) => s.edit);
  const store = useProjectStoreApi();
  const recent = useAppStore((s) => s.recent);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const commit = (value: string) => {
    const next = value.trim();
    if (next && next !== name)
      edit('Rename theme', (d) => void (d.metadata.name = next));
    setEditing(false);
  };
  const duplicate = () =>
    runtime
      .runPromise(duplicateProject(themeId, store.getState().doc))
      .then((id) => navigate(`/editor/${id}/project`));

  if (editing)
    return (
      <TextInput
        size="xs"
        w={220}
        defaultValue={name}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(e.currentTarget.value);
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  return (
    <>
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
          <Menu.Item
            leftSection={<IconPencil size={16} />}
            onClick={() => setEditing(true)}
          >
            Rename theme…
          </Menu.Item>
          <Menu.Item leftSection={<IconCopy size={16} />} onClick={duplicate}>
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
            component={Link}
            to="/editor"
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
              to={`/editor/${t.id}/project`}
              leftSection={<IconFile size={16} />}
              rightSection={
                <Group gap={6} wrap="nowrap">
                  <Text fz={11} c="dimmed">
                    {ago(t.lastOpened)}
                  </Text>
                  {t.id === themeId && (
                    <IconCheck size={16} color="var(--mantine-color-blue-6)" />
                  )}
                </Group>
              }
            >
              {t.name}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconPlus size={16} />}
            component={Link}
            to={`/editor/${newProjectId()}/project`}
          >
            New theme
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </>
  );
}

export default function App() {
  const { id: themeId = '', section } = useParams();
  const project = useProject(themeId);

  const current = SECTIONS.find((s) => s.id === section);
  if (!current) return <Navigate to={`/editor/${themeId}/controls`} replace />;
  const open = project.status === 'open';
  return (
    <ProjectStoreProvider value={open ? project.store : undefined}>
      <Shell themeId={themeId} current={current} project={project}>
        {project.status === 'loading' && (
          <Center h="60vh">
            <Loader />
          </Center>
        )}
        {project.status === 'error' && (
          <Center h="60vh" p="xl">
            <Alert color="red" title="Could not open this project" maw={520}>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {project.message}
              </pre>
            </Alert>
          </Center>
        )}
        {open && <TouchRecent themeId={themeId} />}
        {open && current.id === 'project' && <ProjectPage />}
        {open && current.id === 'tokens' && <TokensPage />}
        {open && current.id === 'controls' && <ControlsPage />}
        {open && current.id === 'preview' && <PreviewPage />}
      </Shell>
    </ProjectStoreProvider>
  );
}

const SETTINGS = { id: 'settings', label: 'Settings' } as const;
/** /editor/settings: the shell without a project; rail links target the latest project. */
export function SettingsRoute() {
  const latest = useAppStore((s) => s.recent[0]?.id);
  return (
    <Shell themeId={latest} current={SETTINGS}>
      <SettingsPage />
    </Shell>
  );
}

/** The header name while the project loads: whatever recents knew it as. */
function RecentName({ themeId }: { themeId: string }) {
  const name = useAppStore((s) => s.recent.find((r) => r.id === themeId)?.name);
  return (
    <Text fw={600} c="dimmed">
      {name ?? 'Loading…'}
    </Text>
  );
}

/** Records the open project in recents as its name changes. */
function TouchRecent({ themeId }: { themeId: string }) {
  const name = useProjectStore((s) => s.doc.metadata.name);
  const touchRecent = useAppStore((s) => s.touchRecent);
  useEffect(
    () => touchRecent({ id: themeId, name }),
    [themeId, name, touchRecent],
  );
  return null;
}

function Shell({
  themeId,
  current,
  project,
  children,
}: {
  /** Undefined only when no project has ever been opened. */
  themeId: string | undefined;
  current: { id: string; label: string };
  project?: ProjectState;
  children: React.ReactNode;
}) {
  const open = project?.status === 'open';
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
          <Text
            fw={700}
            c="blue.6"
            fz={16}
            component={Link}
            to="/editor"
            style={{ textDecoration: 'none' }}
          >
            Galapa Theme Studio
          </Text>
          <Slash />
          {open && themeId ? (
            <ThemeMenu themeId={themeId} />
          ) : (
            project && themeId && <RecentName themeId={themeId} />
          )}
          {project && <Slash />}
          <Text c="dimmed">{current.label}</Text>
          {open && <SaveBadge />}
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
                to={themeId ? `/editor/${themeId}/${id}` : '/editor'}
              >
                <Icon size={20} />
              </ActionIcon>
            </Tooltip>
          ))}
          <Box flex={1} />
          <Tooltip label="Settings" position="bottom">
            <ActionIcon
              size="lg"
              variant={current.id === 'settings' ? 'light' : 'subtle'}
              color={current.id === 'settings' ? 'blue' : 'gray'}
              aria-label="Settings"
              aria-current={current.id === 'settings' ? 'page' : undefined}
              component={Link}
              to="/editor/settings"
            >
              <IconSettings size={20} />
            </ActionIcon>
          </Tooltip>
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-8))">
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
