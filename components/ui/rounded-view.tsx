import { View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';

export type RoundedViewProps = ViewProps & {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  variant?: 'light' | 'dark' | 'surface';
  style?: StyleProp<ViewStyle>;
};

const borderRadius = {
  sm: 0.5,
  md: 1,
  lg: 2,
  xl: 3,
  full: 9999,
};

export function RoundedView({ size = 'md', variant = 'light', style, ...props }: RoundedViewProps) {
  const radius = borderRadius[size];
  
  return (
    <View
      style={[
        {
          borderRadius: radius,
        },
        style,
      ]}
      {...props}
    />
  );
}