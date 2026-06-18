import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type IconButtonProps = PressableProps & {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({ name, size = 24, color, style, ...props }: IconButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        {
          opacity: pressed ? 0.7 : 1,
          width: size + 16,
          height: size + 16,
          borderRadius: (size + 16) / 2,
          justifyContent: 'center',
          alignItems: 'center',
        },
        style,
      ]}
      {...props}>
      <Ionicons name={name as any} size={size} color={color} />
    </Pressable>
  );
}