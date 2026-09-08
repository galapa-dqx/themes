import { useEffect, useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Button,
  Group,
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
import {
  createProjectStore,
  newDocument,
  ProjectStoreProvider,
  useProjectStore,
} from '@/editor/projectStore';

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

export default function App() {
  const { id: themeId = '', section } = useParams();
  // ponytail: a blank document per route until projects load from OPFS.
  const store = useMemo(
    () => createProjectStore(newDocument(themeId)),
    [themeId],
  );
  const touchRecent = useAppStore((s) => s.touchRecent);
  useEffect(
    () => touchRecent({ id: themeId, name: themeId }),
    [themeId, touchRecent],
  );

  const current = SECTIONS.find((s) => s.id === section);
  if (!current) return <Navigate to={`/editor/${themeId}/controls`} replace />;

  return (
    <ProjectStoreProvider value={store}>
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
