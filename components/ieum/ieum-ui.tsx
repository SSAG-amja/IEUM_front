import { StyleSheet, Text, View } from 'react-native';

import { IeumColors } from '@/constants/theme';

export function Pill({ children, emphasis = false }: { children: string; emphasis?: boolean }) {
  return (
    <View style={[styles.pill, emphasis && styles.pillEmphasis]}>
      <Text style={[styles.pillText, emphasis && styles.pillTextEmphasis]}>{children}</Text>
    </View>
  );
}

export function ActionLine({
  count,
  label,
  muted = false,
}: {
  count: number;
  label: string;
  muted?: boolean;
}) {
  return (
    <View style={[styles.actionLine, muted && styles.actionLineMuted]}>
      <Text style={[styles.actionText, muted && styles.actionTextMuted]}>
        {count}번 터치 · {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#394353',
    backgroundColor: '#1B2534',
    borderRadius: 30,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillEmphasis: {
    borderColor: '#8A6A26',
    backgroundColor: '#40351B',
  },
  pillText: {
    color: '#D5DBE4',
    fontSize: 12,
    fontWeight: '600',
  },
  pillTextEmphasis: {
    color: IeumColors.amber,
  },
  actionLine: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: IeumColors.border,
    backgroundColor: '#172130',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionLineMuted: {
    borderColor: '#1E2838',
    backgroundColor: '#131C29',
  },
  actionText: {
    textAlign: 'center',
    color: '#DDE3EC',
    fontSize: 12,
    fontWeight: '700',
  },
  actionTextMuted: {
    color: '#617084',
  },
});
