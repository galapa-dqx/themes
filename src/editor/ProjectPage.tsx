import {
  Alert,
  Button,
  Card,
  FileButton,
  Group,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { ROOT_CONTROL_IDS } from '@/theme/catalog';
import { THEME_FORMAT_VERSION } from '@/theme/schema';
import { COVER_PATH, coverSvg } from './cover';
import { writeProjectFile } from './persistence';
import { previewMime } from './projectList';
import { useProjectStore, useProjectStoreApi } from './projectStore';
import { runtime } from './runtime';
import { useProjectFile } from './useProjectFile';
import { useExportTheme } from './transfer';

// ponytail: every keystroke is one undo entry; coalesce by label if that annoys.
export function ProjectPage() {
  const metadata = useProjectStore((s) => s.doc.metadata);
  const defined = useProjectStore((s) => Object.keys(s.doc.controls).length);
  const edit = useProjectStore((s) => s.edit);
  const exportTheme = useExportTheme();

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
        <CoverField />
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
          <Button
            fullWidth
            mt={14}
            size="sm"
            loading={exportTheme.busy}
            onClick={exportTheme.run}
          >
            Export .galapatheme
          </Button>
          {exportTheme.modal}
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

/** 4d: the preview image, generated from the theme's fills or uploaded. */
function CoverField() {
  const path = useProjectStore((s) => s.doc.metadata.previewImage);
  const dir = useProjectStore((s) => s.dir);
  const edit = useProjectStore((s) => s.edit);
  const store = useProjectStoreApi();
  const file = useProjectFile(path, path ? previewMime(path) : undefined);
  const save = (target: string, bytes: Uint8Array) =>
    runtime
      .runPromise(writeProjectFile(dir, target, bytes))
      .then(() =>
        edit('Set cover', (d) => void (d.metadata.previewImage = target)),
      );
  const generate = () =>
    save(COVER_PATH, new TextEncoder().encode(coverSvg(store.getState().doc)));
  const upload = (f: File | null) =>
    f?.arrayBuffer().then((buf) => {
      const ext =
        f.type === 'image/svg+xml'
          ? 'svg'
          : f.type === 'image/png'
            ? 'png'
            : 'jpg';
      return save(`./assets/preview.${ext}`, new Uint8Array(buf));
    });
  return (
    <div>
      <Text fw={500} fz={13} mb={6}>
        Cover
      </Text>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div
          style={{
            aspectRatio: '4 / 3',
            borderRadius: 'var(--mantine-radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--mantine-color-default-border)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--mantine-color-dimmed)',
            fontSize: 12,
          }}
        >
          {file?.file ? (
            <img
              src={file.file.url}
              alt="Theme cover"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            (file?.error ?? 'No cover')
          )}
        </div>
        <Stack gap={8} align="flex-start">
          <Button variant="default" size="xs" onClick={generate}>
            Generate from theme
          </Button>
          <FileButton
            onChange={upload}
            accept="image/svg+xml,image/png,image/jpeg"
          >
            {(props) => (
              <Button {...props} variant="subtle" size="xs">
                Upload image…
              </Button>
            )}
          </FileButton>
          <Text fz={12} c="dimmed">
            SVG, PNG or JPEG, 4:3. The generated cover is an SVG painted from
            the window, panel and button fills; the export rasterizes it.
          </Text>
        </Stack>
      </div>
    </div>
  );
}
