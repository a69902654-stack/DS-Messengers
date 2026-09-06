import MiniMusicPlayer from '../../components/mini-music-player';
import { MusicProvider } from '../../context/music-context';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  const bottomOffset = insets.bottom > 0 ? insets.bottom + 8 : 20;

  return (
    <MusicProvider>
    <MiniMusicPlayer />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { bottom: bottomOffset }],
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.4)',
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'چت‌ها',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
              <Ionicons
                name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
                size={focused ? 26 : 22}
                color={color}
              />
              {focused && <View style={styles.dot} />}
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'مخاطبین',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
              <Ionicons
                name={focused ? 'people' : 'people-outline'}
                size={focused ? 26 : 22}
                color={color}
              />
              {focused && <View style={styles.dot} />}
            </View>
          ),
        }}
      />
      <Tabs.Screen
  name="chatbot"
  options={{
    title: 'دستیار',
    tabBarIcon: ({ color, focused }) => (
      <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
        <Ionicons
          name={focused ? 'sparkles' : 'sparkles-outline'}
          size={focused ? 26 : 22}
          color={color}
        />
        {focused && <View style={styles.dot} />}
      </View>
    ),
  }}
/>

      <Tabs.Screen
        name="profile"
        options={{
          title: 'پروفایل',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={focused ? 26 : 22}
                color={color}
              />
              {focused && <View style={styles.dot} />}
            </View>
          ),
        }}
      />
      
      <Tabs.Screen
        name="music"
        options={{
          title: 'موزیک',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconContainer, focused && styles.iconContainerFocused]}>
              <Ionicons
                name={focused ? 'musical-notes' : 'musical-notes-outline'}
                size={focused ? 26 : 22}
                color={color}
              />
              {focused && <View style={styles.dot} />}
            </View>
          ),
        }}
      />
    </Tabs>
    </MusicProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 65,
    borderRadius: 32,
    backgroundColor: 'rgba(20, 20, 35, 0.95)',
    borderTopWidth: 0,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0,
  },
  tabBarItem: {
    borderRadius: 25,
    marginHorizontal: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerFocused: {
    transform: [{ translateY: -6 }],
  },
  dot: {
    position: 'absolute',
    bottom: -8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ffffff',
  },
});
