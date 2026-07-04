import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodePanel } from '@/components/BarcodePanel';
import { ParsedReview } from '@/components/ParsedReview';
import { Card, Chip, LabeledInput, Muted, PrimaryButton, SegmentedControl } from '@/components/ui';
import { VoiceButton } from '@/components/VoiceButton';
import { aiParseFood } from '@/lib/aiParse';
import { parserPool, searchFoods } from '@/lib/foodSearch';
import { scaleFood } from '@/lib/nutrition';
import { ParsedItem, parseFoodText } from '@/lib/parser';
import { isSpeechAvailable, SpeechSession, startListening } from '@/lib/speech';
import { supabase } from '@/lib/supabase';
import { Food, Meal, MEALS, todayKey } from '@/lib/types';
import { useLogStore } from '@/stores/useLogStore';
import { colors, font, radius, spacing } from '@/theme';

type Mode = 'talk' | 'search' | 'scan';

function defaultMeal(): Meal {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 19) return 'snack';
  return 'dinner';
}

export default function LogScreen() {
  const params = useLocalSearchParams<{ meal?: string; date?: string }>();
  const addParsedItems = useLogStore((s) => s.addParsedItems);
  const addEntry = useLogStore((s) => s.addEntry);
  const addCustomFood = useLogStore((s) => s.addCustomFood);
  const customFoods = useLogStore((s) => s.customFoods);

  const [mode, setMode] = useState<Mode>('talk');
  const [meal, setMeal] = useState<Meal>(
    MEALS.includes(params.meal as Meal) ? (params.meal as Meal) : defaultMeal(),
  );
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : todayKey();

  // keep meal in sync when navigated from a specific meal's + button
  useEffect(() => {
    if (MEALS.includes(params.meal as Meal)) setMeal(params.meal as Meal);
  }, [params.meal]);

  const [banner, setBanner] = useState<string | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBanner = (msg: string) => {
    setBanner(msg);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 2500);
  };
  useEffect(() => () => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
  }, []);

  const pool = useMemo(() => parserPool(customFoods), [customFoods]);

  // ---- talk state ----
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const session = useRef<SpeechSession | null>(null);
  const speechSupported = isSpeechAvailable();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => data.subscription.unsubscribe();
  }, []);

  const runParse = (text: string) => {
    setSpeechError(null);
    const parsed = parseFoodText(text, pool);
    setItems(parsed);
    if (!parsed.length && text.trim()) {
      setSpeechError('Could not find any food in that. Try “200 g chicken breast and 1 roti”.');
    }
  };

  const toggleListening = async () => {
    if (listening) {
      session.current?.stop();
      return;
    }
    setTranscript('');
    setItems([]);
    setSpeechError(null);
    setListening(true);
    session.current = await startListening({
      onPartial: setTranscript,
      onFinal: (text) => {
        setTranscript(text);
        runParse(text);
      },
      onError: (message) => {
        setSpeechError(message);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    if (!session.current) setListening(false);
  };

  const tryAiParse = async () => {
    const text = transcript || typed;
    if (!text.trim()) return;
    setAiLoading(true);
    const aiItems = await aiParseFood(text, pool);
    setAiLoading(false);
    if (aiItems) setItems(aiItems);
    else setSpeechError('AI parse unavailable (sign in required, and the server needs an API key).');
  };

  const matchedItems = items.filter((i) => i.food && i.grams > 0);
  const totalKcal = matchedItems.reduce((sum, i) => sum + scaleFood(i.food!, i.grams).kcal, 0);

  const commitItems = () => {
    const added = addParsedItems(matchedItems, dateKey, meal, speechSupported && transcript ? 'voice' : 'manual');
    if (added > 0) {
      setItems([]);
      setTranscript('');
      setTyped('');
      showBanner(`Logged ${added} item${added > 1 ? 's' : ''} · ${Math.round(totalKcal)} kcal`);
    }
  };

  // ---- search state ----
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const results = useMemo(
    () => (query.trim() ? searchFoods(query, customFoods) : []),
    [query, customFoods],
  );

  const commitSearch = () => {
    const g = Number(grams);
    if (!selected || !Number.isFinite(g) || g <= 0) return;
    const entry = addEntry({ dateKey, meal, food: selected, grams: g, source: 'search' });
    if (entry) {
      showBanner(`Logged ${selected.name} · ${entry.kcal} kcal`);
      setSelected(null);
      setQuery('');
      setGrams('');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Log food</Text>

          <SegmentedControl<Mode>
            options={['talk', 'search', 'scan'] as const}
            value={mode}
            onChange={setMode}
            labels={{ talk: '🎙 Talk', search: '🔍 Search', scan: '▮ Scan' }}
          />

          <View style={{ gap: spacing(1.5) }}>
            <Text style={styles.label}>Meal · {dateKey === todayKey() ? 'today' : dateKey}</Text>
            <SegmentedControl<Meal> options={MEALS} value={meal} onChange={setMeal} />
          </View>

          {banner && (
            <View style={styles.banner}>
              <Ionicons name="checkmark-circle" size={16} color={colors.onAccent} />
              <Text style={styles.bannerText}>{banner}</Text>
            </View>
          )}

          {mode === 'talk' && (
            <Card style={{ gap: spacing(4), alignItems: 'center' }}>
              {speechSupported ? (
                <>
                  <VoiceButton listening={listening} onPress={toggleListening} />
                  <Muted style={{ textAlign: 'center' }}>
                    {listening
                      ? 'Listening… tap to stop'
                      : 'Tap the mic and say what you ate'}
                  </Muted>
                </>
              ) : (
                <Muted style={{ textAlign: 'center' }}>
                  Voice input isn’t available here (Expo Go doesn’t include the speech module —
                  use a dev build, or the web app). Type instead:
                </Muted>
              )}

              {transcript ? <Text style={styles.transcript}>“{transcript}”</Text> : null}

              <View style={styles.typeRow}>
                <TextInput
                  style={styles.typeInput}
                  placeholder="…or type: 2 eggs and 1 glass of milk"
                  placeholderTextColor={colors.textFaint}
                  value={typed}
                  onChangeText={setTyped}
                  onSubmitEditing={() => runParse(typed)}
                  returnKeyType="done"
                />
                <Pressable style={styles.parseBtn} onPress={() => runParse(typed)}>
                  <Ionicons name="arrow-forward" size={18} color={colors.onAccent} />
                </Pressable>
              </View>

              {speechError && <Text style={styles.error}>{speechError}</Text>}

              {items.length > 0 && (
                <View style={{ alignSelf: 'stretch', gap: spacing(3) }}>
                  <ParsedReview items={items} onChange={setItems} />
                  <PrimaryButton
                    title={`Log ${matchedItems.length} item${matchedItems.length === 1 ? '' : 's'} · ${Math.round(totalKcal)} kcal`}
                    onPress={commitItems}
                    disabled={matchedItems.length === 0}
                  />
                </View>
              )}

              {signedIn && (transcript || typed) ? (
                aiLoading ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Pressable onPress={tryAiParse}>
                    <Text style={styles.aiLink}>✨ Try AI parse (Claude)</Text>
                  </Pressable>
                )
              ) : null}
            </Card>
          )}

          {mode === 'search' && (
            <Card style={{ gap: spacing(3.5) }}>
              <LabeledInput
                label="Search 328 foods + your custom foods"
                placeholder="paneer, dal makhani, chicken breast…"
                value={query}
                onChangeText={(t) => {
                  setQuery(t);
                  setSelected(null);
                }}
                autoCorrect={false}
              />
              {!selected &&
                results.map((f) => (
                  <Pressable
                    key={f.id}
                    style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.6 }]}
                    onPress={() => {
                      setSelected(f);
                      setGrams(String(f.default_portion_g));
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultName}>{f.name}</Text>
                      <Text style={styles.resultSub}>
                        {f.kcal_100g} kcal/100g · {f.portion_label} ≈ {f.default_portion_g} g
                      </Text>
                    </View>
                    <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
                  </Pressable>
                ))}

              {!selected && query.trim() !== '' && results.length === 0 && (
                <Muted>No match. Create it as a custom food below.</Muted>
              )}

              {!selected && query.trim() !== '' && (
                <Pressable onPress={() => setShowCustomForm(!showCustomForm)}>
                  <Text style={styles.aiLink}>
                    {showCustomForm ? 'Hide custom food form' : '+ Create custom food'}
                  </Text>
                </Pressable>
              )}

              {showCustomForm && !selected && (
                <CustomFoodForm
                  initialName={query}
                  onCreate={(food) => {
                    setShowCustomForm(false);
                    setSelected(food);
                    setGrams(String(food.default_portion_g));
                  }}
                  addCustomFood={addCustomFood}
                />
              )}

              {selected && (
                <View style={{ gap: spacing(3) }}>
                  <Text style={styles.resultName}>{selected.name}</Text>
                  <LabeledInput
                    label="Amount (grams)"
                    value={grams}
                    onChangeText={setGrams}
                    keyboardType="numeric"
                  />
                  {Number(grams) > 0 && (
                    <Muted>
                      {scaleFood(selected, Number(grams)).kcal} kcal · P{' '}
                      {scaleFood(selected, Number(grams)).proteinG} g · C{' '}
                      {scaleFood(selected, Number(grams)).carbsG} g · F{' '}
                      {scaleFood(selected, Number(grams)).fatG} g
                    </Muted>
                  )}
                  <PrimaryButton
                    title={`Add to ${meal}`}
                    onPress={commitSearch}
                    disabled={!(Number(grams) > 0)}
                  />
                  <Pressable onPress={() => setSelected(null)}>
                    <Text style={styles.aiLink}>Back to results</Text>
                  </Pressable>
                </View>
              )}
            </Card>
          )}

          {mode === 'scan' && (
            <BarcodePanel
              onLogged={(name, kcal) => showBanner(`Logged ${name} · ${kcal} kcal`)}
              meal={meal}
              dateKey={dateKey}
            />
          )}

          <Pressable onPress={() => router.push('/today')}>
            <Text style={[styles.aiLink, { textAlign: 'center' }]}>Done → back to Today</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CustomFoodForm({
  initialName,
  onCreate,
  addCustomFood,
}: {
  initialName: string;
  onCreate: (food: Food) => void;
  addCustomFood: ReturnType<typeof useLogStore.getState>['addCustomFood'];
}) {
  const [name, setName] = useState(initialName);
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const nums = [kcal, protein, carbs, fat].map(Number);
  const valid =
    name.trim().length > 0 &&
    nums.every((n) => Number.isFinite(n) && n >= 0) &&
    nums[0] <= 900 &&
    nums.slice(1).every((n) => n <= 100);

  return (
    <View style={{ gap: spacing(3) }}>
      <LabeledInput label="Name" value={name} onChangeText={setName} />
      <LabeledInput label="Calories per 100 g" value={kcal} onChangeText={setKcal} keyboardType="numeric" />
      <View style={{ flexDirection: 'row', gap: spacing(2.5) }}>
        <View style={{ flex: 1 }}>
          <LabeledInput label="Protein /100g" value={protein} onChangeText={setProtein} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <LabeledInput label="Carbs /100g" value={carbs} onChangeText={setCarbs} keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <LabeledInput label="Fat /100g" value={fat} onChangeText={setFat} keyboardType="numeric" />
        </View>
      </View>
      <PrimaryButton
        title="Create food"
        disabled={!valid}
        onPress={() => {
          const food = addCustomFood({
            name: name.trim(),
            kcal_100g: nums[0],
            protein_100g: nums[1],
            carbs_100g: nums[2],
            fat_100g: nums[3],
            barcode: null,
          });
          onCreate(food);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing(4),
    gap: spacing(3.5),
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: spacing(10),
  },
  title: {
    color: colors.text,
    fontFamily: font.extrabold,
    fontSize: 24,
  },
  label: {
    color: colors.textMuted,
    fontFamily: font.medium,
    fontSize: 13,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  bannerText: {
    color: colors.onAccent,
    fontFamily: font.semibold,
    fontSize: 14,
  },
  transcript: {
    color: colors.text,
    fontFamily: font.medium,
    fontSize: 16,
    textAlign: 'center',
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing(2),
    alignSelf: 'stretch',
  },
  typeInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontFamily: font.regular,
    fontSize: 14,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
  },
  parseBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
  },
  error: {
    color: colors.danger,
    fontFamily: font.regular,
    fontSize: 13,
    textAlign: 'center',
  },
  aiLink: {
    color: colors.carbs,
    fontFamily: font.semibold,
    fontSize: 14,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingVertical: spacing(2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultName: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
  },
  resultSub: {
    color: colors.textFaint,
    fontFamily: font.regular,
    fontSize: 12,
    marginTop: 1,
  },
});
