import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { lookupBarcode, ScannedProduct } from '../lib/openFoodFacts';
import { scaleFood } from '../lib/nutrition';
import { Food, Meal } from '../lib/types';
import { useLogStore } from '../stores/useLogStore';
import { colors, font, radius, spacing } from '../theme';
import { Card, LabeledInput, Muted, PrimaryButton } from './ui';

/**
 * Barcode logging panel: live camera scanning on iOS/Android (expo-camera),
 * manual barcode entry everywhere (the only option on web). Product data
 * comes from Open Food Facts.
 */
export function BarcodePanel({
  meal,
  dateKey,
  onLogged,
}: {
  meal: Meal;
  dateKey: string;
  onLogged: (name: string, kcal: number) => void;
}) {
  const addEntry = useLogStore((s) => s.addEntry);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [grams, setGrams] = useState('');
  const busy = useRef(false);

  const canUseCamera = Platform.OS !== 'web';

  const handleCode = async (code: string) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    setScanning(false);
    const result = await lookupBarcode(code);
    setLoading(false);
    busy.current = false;
    if (!result.ok) {
      setProduct(null);
      setError(
        result.reason === 'not_found'
          ? `Barcode ${code} isn’t in Open Food Facts. Add it via Search → custom food.`
          : result.reason === 'no_nutrition'
            ? 'Product found but it has no nutrition data. Add it as a custom food instead.'
            : 'Network error — check your connection and try again.',
      );
      return;
    }
    setProduct(result.product);
    setGrams(String(result.product.servingG ?? 100));
  };

  const startScanning = async () => {
    setError(null);
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setError('Camera permission denied. Use manual barcode entry below.');
        return;
      }
    }
    setProduct(null);
    setScanning(true);
  };

  const productAsFood = (p: ScannedProduct): Food => ({
    id: `barcode-${p.barcode}`,
    name: p.brand ? `${p.name} (${p.brand})` : p.name,
    aliases: [],
    category: 'barcode',
    kcal_100g: p.kcal_100g,
    protein_100g: p.protein_100g,
    carbs_100g: p.carbs_100g,
    fat_100g: p.fat_100g,
    default_portion_g: p.servingG ?? 100,
    portion_label: p.servingG ? '1 serving' : '100 g',
  });

  const commit = () => {
    if (!product) return;
    const g = Number(grams);
    if (!Number.isFinite(g) || g <= 0) return;
    const food = productAsFood(product);
    const macros = scaleFood(food, g);
    const entry = addEntry({
      dateKey,
      meal,
      name: food.name,
      grams: g,
      macros,
      source: 'barcode',
    });
    if (entry) {
      onLogged(food.name, entry.kcal);
      setProduct(null);
      setManualCode('');
      setGrams('');
    }
  };

  return (
    <Card style={{ gap: spacing(4) }}>
      {canUseCamera ? (
        scanning ? (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
              }}
              onBarcodeScanned={({ data }) => data && handleCode(data)}
            />
            <Pressable style={styles.cancelScan} onPress={() => setScanning(false)}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
            <View style={styles.scanFrame} />
          </View>
        ) : (
          <PrimaryButton title="Scan barcode with camera" onPress={startScanning} />
        )
      ) : (
        <Muted>
          Camera scanning works in the iOS/Android app. On web, type the barcode number from the
          package:
        </Muted>
      )}

      <View style={{ gap: spacing(2) }}>
        <LabeledInput
          label="Barcode number"
          placeholder="8901058000290"
          value={manualCode}
          onChangeText={setManualCode}
          keyboardType="numeric"
          onSubmitEditing={() => manualCode && handleCode(manualCode)}
        />
        <PrimaryButton
          title="Look up"
          onPress={() => handleCode(manualCode)}
          disabled={!/^\d{6,14}$/.test(manualCode.trim())}
        />
      </View>

      {loading && <ActivityIndicator color={colors.accent} />}
      {error && <Text style={styles.error}>{error}</Text>}

      {product && (
        <View style={styles.productCard}>
          <Text style={styles.productName}>
            {product.name}
            {product.brand ? <Text style={{ color: colors.textMuted }}> · {product.brand}</Text> : null}
          </Text>
          <Muted>
            Per 100 g: {product.kcal_100g} kcal · P {product.protein_100g} g · C{' '}
            {product.carbs_100g} g · F {product.fat_100g} g
          </Muted>
          <LabeledInput
            label="Amount eaten (grams)"
            value={grams}
            onChangeText={setGrams}
            keyboardType="numeric"
          />
          <PrimaryButton title={`Add to ${meal}`} onPress={commit} disabled={!(Number(grams) > 0)} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    height: 260,
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  scanFrame: {
    width: 200,
    height: 120,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
  },
  cancelScan: {
    position: 'absolute',
    top: spacing(2),
    right: spacing(2),
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.full,
    padding: spacing(1.5),
  },
  error: {
    color: colors.danger,
    fontFamily: font.regular,
    fontSize: 13,
  },
  productCard: {
    gap: spacing(3),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing(3.5),
  },
  productName: {
    color: colors.text,
    fontFamily: font.bold,
    fontSize: 16,
  },
});
