import {
  Alert,
  Button,
  Card,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { ROOT_CONTROL_IDS } from '@/theme/catalog';
import { THEME_FORMAT_VERSION } from '@/theme/schema';
import { useProjectStore } from './projectStore';

// ponytail: every keystroke is one undo entry; coalesce by label if that annoys.
export function ProjectPage() {
  const metadata = useProjectStore((s) => s.doc.metadata);
  const defined = useProjectStore((s) => Object.keys(s.doc.controls).length);
  const edit = useProjectStore((s) => s.edit);

  return (
    <div
      style={{
        padding: '24px 32px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 520px) 340px',
        gap: 32,
        alignContent: 'start',
      }}
    >
      <Stack gap={20}>
        <div>
          <Title order={2} fz={20}>
            Project
          </Title>
          <Text c="dimmed" fz={13}>
            Shown in the Galapa theme picker and inside the exported package.
          </Text>
        </div>
        <TextInput
          label="Name"
          required
          value={metadata.name}
          error={metadata.name ? undefined : 'A name is required'}
          onChange={(e) =>
            edit('Rename theme', (d) => void (d.metadata.name = e.target.value))
          }
        />
        <TextInput
          label="Author"
          description="Displayed next to the theme name"
          value={metadata.author.name}
          onChange={(e) =>
            edit(
              'Edit author',
              (d) => void (d.metadata.author.name = e.target.value),
            )
          }
        />
        <Textarea
          label="Description"
          rows={4}
          value={metadata.description ?? ''}
          onChange={(e) =>
            edit('Edit description', (d) => {
              if (e.target.value) d.metadata.description = e.target.value;
              else delete d.metadata.description;
            })
          }
        />
      </Stack>
      <Stack gap={16} pt={44}>
        <Card shadow="xs">
          <Text fw={600} mb={10}>
            Package
          </Text>
          <Stack gap={8} fz={13}>
            <Group justify="space-between">
              <Text c="dimmed" fz={13}>
                Format
              </Text>
              <Text ff="monospace" fz={12}>
                galapa-theme v{THEME_FORMAT_VERSION}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text c="dimmed" fz={13}>
                Controls
              </Text>
              <Text fz={13}>
                {defined} / {ROOT_CONTROL_IDS.length} defined
              </Text>
            </Group>
          </Stack>
          {/* ponytail: enabled once the compiler runs in the browser. */}
          <Button fullWidth mt={14} size="sm" disabled>
            Export .galtheme
          </Button>
        </Card>
        {defined < ROOT_CONTROL_IDS.length && (
          <Alert color="orange" title="Incomplete theme">
            Every catalog control must be defined before the theme can be
            exported.
          </Alert>
        )}
      </Stack>
    </div>
  );
}
