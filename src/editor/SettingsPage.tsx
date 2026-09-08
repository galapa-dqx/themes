import {
  SegmentedControl,
  Stack,
  Text,
  Title,
  useMantineColorScheme,
} from '@mantine/core';

export function SettingsPage() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <Stack gap={20} p="24px 32px" maw={520}>
      <div>
        <Title order={2} fz={20}>
          Settings
        </Title>
        <Text c="dimmed" fz={13}>
          Preferences for this browser. Theme projects are unaffected.
        </Text>
      </div>
      <div>
        <Text fw={500} fz={13} mb={6}>
          Appearance
        </Text>
        <SegmentedControl
          value={colorScheme}
          onChange={(v) => setColorScheme(v as typeof colorScheme)}
          data={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'auto', label: 'Auto' },
          ]}
        />
      </div>
    </Stack>
  );
}
