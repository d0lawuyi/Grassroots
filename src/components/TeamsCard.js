import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { apiAvailable, makeTeams } from '../lib/api';
import { COLORS } from '../theme/colors';

/*
 * TEAMS on the game page.
 *   - Everyone sees the teams once they're made (read from game_teams).
 *   - The organizer gets "Make teams": the Grassroots API runs the C++ solver
 *     (services/teams-solver), which balances the sides using each player's level.
 */
const TEAM_COLORS = [COLORS.forest, COLORS.clay, COLORS.teal, COLORS.plum];
const MIN_PER_TEAM = 2;

function shortName(fullName) {
  const parts = (fullName || 'Player').trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

export default function TeamsCard({ game, players, userId }) {
  const [rows, setRows] = useState([]); // game_teams rows: { player_id, team }
  const [loading, setLoading] = useState(true);
  const [making, setMaking] = useState(false);
  const [teamCount, setTeamCount] = useState(2);
  const [result, setResult] = useState(null); // the API's answer right after making teams

  const isOrganizer = game?.organizer_id === userId;
  const playerIds = useMemo(() => players.map((p) => p.player_id), [players]);
  const names = useMemo(
    () => Object.fromEntries(players.map((p) => [p.player_id, shortName(p.users?.full_name)])),
    [players]
  );

  const load = useCallback(async () => {
    if (!game?.game_id) return;
    const { data } = await supabase
      .from('game_teams')
      .select('player_id, team')
      .eq('game_id', game.game_id);
    setRows(data || []);
    setLoading(false);
  }, [game?.game_id]);

  useEffect(() => {
    load();
  }, [load, playerIds.length]);

  // Group the saved rows into teams, keeping only players still in the game
  const teams = useMemo(() => {
    const byTeam = {};
    for (const r of rows) {
      if (!playerIds.includes(r.player_id)) continue;
      (byTeam[r.team] = byTeam[r.team] || []).push(r.player_id);
    }
    return Object.keys(byTeam)
      .sort((a, b) => a - b)
      .map((t) => ({ team: Number(t), players: byTeam[t] }));
  }, [rows, playerIds]);

  const placed = new Set(rows.map((r) => r.player_id));
  const rosterChanged =
    rows.length > 0 &&
    (playerIds.some((id) => !placed.has(id)) || rows.some((r) => !playerIds.includes(r.player_id)));

  const maxTeams = Math.min(4, Math.floor(players.length / MIN_PER_TEAM));
  const canMake = isOrganizer && apiAvailable && maxTeams >= 2;

  useEffect(() => {
    if (teamCount > maxTeams && maxTeams >= 2) setTeamCount(maxTeams);
  }, [maxTeams, teamCount]);

  async function handleMake() {
    setMaking(true);
    try {
      const answer = await makeTeams(game.game_id, teamCount);
      setResult(answer);
      await load();
    } catch (e) {
      Alert.alert('Could not make teams', e.message);
    } finally {
      setMaking(false);
    }
  }

  // Nothing to show: no teams yet and this person can't make them
  if (loading || (teams.length === 0 && !canMake)) {
    if (!loading && teams.length === 0 && !isOrganizer && players.length >= 4) {
      return (
        <View style={s.card}>
          <Text style={s.title}>TEAMS</Text>
          <Text style={s.note}>The organizer hasn't picked teams yet.</Text>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>TEAMS</Text>
        {result && (
          <Text style={s.verdict}>
            {result.spread === 0 ? 'Evenly matched' : result.provenBest ? 'As even as it gets' : 'Balanced'}
          </Text>
        )}
      </View>

      {teams.length > 0 ? (
        <View style={s.columns}>
          {teams.map(({ team, players: ids }) => {
            const color = TEAM_COLORS[(team - 1) % TEAM_COLORS.length];
            const hasYou = ids.includes(userId);
            return (
              <View key={team} style={[s.team, teams.length > 2 && s.teamThird]}>
                <View style={s.teamHead}>
                  <View style={[s.dot, { backgroundColor: color }]} />
                  <Text style={s.teamName}>Team {team}</Text>
                  {hasYou && <Text style={[s.youTag, { color }]}>YOU</Text>}
                </View>
                {ids.map((id) => (
                  <Text key={id} style={[s.player, id === userId && s.playerYou]} numberOfLines={1}>
                    {id === userId ? 'You' : names[id] || 'Player'}
                  </Text>
                ))}
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={s.note}>
          Split everyone into fair teams. Each player's level from their profile keeps the sides even.
        </Text>
      )}

      {rosterChanged && (
        <Text style={s.changed}>
          {isOrganizer
            ? 'Players joined or left since these teams were made. Make them again.'
            : 'Players joined or left since these teams were made.'}
        </Text>
      )}

      {canMake && (
        <View style={s.controls}>
          {maxTeams > 2 && (
            <View style={s.counts}>
              {[2, 3, 4].filter((n) => n <= maxTeams).map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[s.count, teamCount === n && s.countOn]}
                  onPress={() => setTeamCount(n)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: teamCount === n }}
                >
                  <Text style={[s.countText, teamCount === n && s.countTextOn]}>{n} teams</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity style={s.button} onPress={handleMake} disabled={making} activeOpacity={0.85}>
            {making ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="shuffle" size={17} color={COLORS.white} />
                <Text style={s.buttonText}>{teams.length > 0 ? 'Make teams again' : 'Make teams'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardFill, borderRadius: 20, padding: 18, marginTop: 14,
    borderWidth: 1, borderColor: COLORS.line,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 10.5, fontWeight: '800', color: COLORS.primary, letterSpacing: 2.2 },
  verdict: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  note: { fontSize: 13, color: COLORS.mute, lineHeight: 19 },
  changed: { fontSize: 12.5, color: COLORS.clay, fontWeight: '600', marginTop: 12, lineHeight: 18 },

  columns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  team: {
    flexGrow: 1, flexBasis: '45%', padding: 12, borderRadius: 14,
    backgroundColor: COLORS.neutral100, borderWidth: 1, borderColor: COLORS.line,
  },
  teamThird: { flexBasis: '30%' },
  teamHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 7 },
  teamName: { fontSize: 14, fontWeight: '800', color: COLORS.snow, flex: 1 },
  youTag: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1 },
  player: { fontSize: 14, color: COLORS.neutral800, paddingVertical: 3 },
  playerYou: { fontWeight: '800', color: COLORS.snow },

  controls: { marginTop: 14 },
  counts: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  count: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.neutral100,
  },
  countOn: { backgroundColor: COLORS.sage, borderColor: COLORS.primary },
  countText: { fontSize: 13, fontWeight: '700', color: COLORS.mute },
  countTextOn: { color: COLORS.primary },
  button: {
    flexDirection: 'row', gap: 8, height: 48, borderRadius: 14,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },
});
