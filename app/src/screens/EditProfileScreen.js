import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { Field, Button } from '../components/ui';
import { updateProfile, uploadAvatar } from '../api/auth';
import { colors } from '../theme/colors';

export default function EditProfileScreen({ navigation }) {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const initial = (displayName || user?.username || '?').charAt(0).toUpperCase();

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return Alert.alert('Permission needed', 'Allow photo access to change your avatar.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const updated = await uploadAvatar(result.assets[0]);
      setUser(updated);
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.error || 'Try again');
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const updated = await updateProfile({ displayName, bio });
      setUser(updated);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Save failed', err.response?.data?.error || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
      <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} disabled={uploading}>
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        <Text style={styles.changePhoto}>{uploading ? 'Uploading…' : 'Change photo'}</Text>
      </TouchableOpacity>

      <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Your name" />
      <Field
        label="Bio"
        value={bio}
        onChangeText={setBio}
        placeholder="Tell people about you"
        multiline
        numberOfLines={3}
      />

      <Button title="Save" onPress={onSave} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  avatarWrap: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.text, fontSize: 40, fontWeight: '800' },
  changePhoto: { color: colors.accent, marginTop: 10, fontWeight: '700' },
});
