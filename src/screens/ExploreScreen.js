import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, Image, StyleSheet, ActivityIndicator, RefreshControl, Modal, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import { COLORS } from '../theme/colors';
import { DARK_MAP } from '../theme/mapStyle';
import LegacyExploreScreen from './LegacyExploreScreen';

const sportChoices = [ ['all','All'], ['soccer','⚽ Soccer'], ['basketball','🏀 Basketball'], ['flag_football','🏈 Football'], ['ultimate','🥏 Ultimate'] ];
const rateLabel = (v) => v == null || !Number.isFinite(Number(v)) || Number(v)<0 ? 'Rate unavailable' : Number(v) === 0 ? 'FREE' : `$${Number(v).toFixed(0)} / hr`;
const isVerified = (venue) => venue?.verification_status === 'approved';
const photosOf = (venue) => Array.isArray(venue?.photos) ? venue.photos.filter(x => typeof x === 'string' && /^https?:\/\//.test(x)) : [];
function VenueCard({ venue, onPress }) {
  const photos=photosOf(venue);
  return <TouchableOpacity onPress={onPress} activeOpacity={0.86} style={s.card}>
    {photos[0] ? <Image source={{uri:photos[0]}} style={s.cardImage}/> : <View style={s.imagePlaceholder}><Ionicons name="football-outline" size={32} color={COLORS.primary}/><Text style={s.muted}>Venue photo unavailable</Text></View>}
    <View style={s.cardBody}>
      <View style={s.row}><Text numberOfLines={1} style={[s.cardTitle,{flex:1}]}>{venue.name}</Text><Text style={s.price}>{rateLabel(venue.hourly_rate)}</Text></View>
      <Text style={s.muted} numberOfLines={2}>{Array.isArray(venue.sports) ? venue.sports.map(v=>v.replaceAll('_',' ')).join(' · ') : 'Sports information unavailable'}</Text>
      <View style={[s.row,{marginTop:10}]}>{isVerified(venue) ? <View style={[s.row,{flex:1}]}><Ionicons name="shield-checkmark" size={15} color={COLORS.success}/><Text style={s.verified}>Verified by Grassroots</Text></View> : <Text style={s.provisional}>Listed location · verification not confirmed</Text>}<Ionicons name="arrow-forward" size={20} color={COLORS.primary}/></View>
    </View>
  </TouchableOpacity>;
}
export default function ExploreScreen({ userLocation, onSelectGame, onCreateGame, onSelectPark, userId }) {
  const [tab,setTab]=useState('venues');
  const [view,setView]=useState('list');
  const [venues,setVenues]=useState([]);
  const [query,setQuery]=useState('');
  const [sport,setSport]=useState('all');
  const [cost,setCost]=useState('all');
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [selected,setSelected]=useState(null);
  const [loadError,setLoadError]=useState('');
  async function load() {
    const {data,error}=await supabase.from('parks').select('*').eq('status','active').order('name');
    if (error) {setLoadError(error.message);setVenues([]);} else {setLoadError('');setVenues(data||[]);}
  }
  useEffect(()=>{load().finally(()=>setLoading(false));},[]);
  const result=useMemo(()=>venues.filter(v=>{
    if (query && !`${v.name||''} ${v.city||''} ${v.state||''}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (sport!=='all' && !(Array.isArray(v.sports)&&v.sports.includes(sport))) return false;
    if (cost==='free' && Number(v.hourly_rate)!==0) return false;
    if (cost==='paid' && !(Number(v.hourly_rate)>0)) return false;
    return true;
  }).sort((a,b)=>Number(isVerified(b))-Number(isVerified(a))),[venues,query,sport,cost]);
  const markers=result.filter(v=>v.latitude != null&&v.longitude != null&&Number.isFinite(Number(v.latitude))&&Number.isFinite(Number(v.longitude)));
  const region={latitude:userLocation?.latitude??39.7684,longitude:userLocation?.longitude??-86.1581,latitudeDelta:0.15,longitudeDelta:0.15};
  return <View style={s.container}>
    <View style={s.header}><Text style={s.brand}>GRASSROOTS</Text><Text style={s.headline}>Find your place to play.</Text><Text style={s.muted}>Browse venues and organize pickup games</Text></View>
    <View style={s.tabs}><TouchableOpacity onPress={()=>setTab('venues')} style={[s.tab,tab==='venues'&&s.activeTab]}><Text style={[s.tabText,tab==='venues'&&s.activeTabText]}>Venues</Text></TouchableOpacity><TouchableOpacity onPress={()=>setTab('games')} style={[s.tab,tab==='games'&&s.activeTab]}><Text style={[s.tabText,tab==='games'&&s.activeTabText]}>Games</Text></TouchableOpacity></View>
    {tab==='games' ? <LegacyExploreScreen userLocation={userLocation} userId={userId} onSelectGame={onSelectGame} onSelectPark={onSelectPark} onCreateGame={onCreateGame}/> : <>
      <View style={s.search}><Ionicons name="search" color={COLORS.mute} size={19}/><TextInput style={s.input} value={query} onChangeText={setQuery} placeholder="Search venues or cities" placeholderTextColor={COLORS.mute}/></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{sportChoices.map(([id,label])=><TouchableOpacity key={id} onPress={()=>setSport(id)} style={[s.chip,sport===id&&s.chipOn]}><Text style={[s.chipText,sport===id&&s.chipTextOn]}>{label}</Text></TouchableOpacity>)}</ScrollView>
      <View style={s.rowBetween}><View style={s.row}>{[['all','All prices'],['free','Free'],['paid','Paid']].map(([id,label])=><TouchableOpacity key={id} onPress={()=>setCost(id)} style={[s.smallChip,cost===id&&s.smallChipOn]}><Text style={[s.smallChipText,cost===id&&s.chipTextOn]}>{label}</Text></TouchableOpacity>)}</View><TouchableOpacity onPress={()=>setView(view==='list'?'map':'list')} style={s.switch}><Ionicons name={view==='list'?'map-outline':'list-outline'} size={17} color={COLORS.primary}/><Text style={s.switchText}>{view==='list'?'Map':'List'}</Text></TouchableOpacity></View>
      {loading ? <ActivityIndicator style={{marginTop:36}} color={COLORS.primary}/> : loadError ? <Text style={s.empty}>Could not load venues: {loadError}</Text> : view==='list' ? <FlatList data={result} keyExtractor={v=>String(v.park_id)} contentContainerStyle={s.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async()=>{setRefreshing(true);try{await load();}finally{setRefreshing(false);}}} tintColor={COLORS.primary}/>} ListHeaderComponent={<Text style={s.count}>{result.length} listed {result.length===1?'venue':'venues'}</Text>} ListEmptyComponent={<Text style={s.empty}>No venues match these filters.</Text>} renderItem={({item})=><VenueCard venue={item} onPress={()=>setSelected(item)}/>}/> : <MapView style={{flex:1}} customMapStyle={DARK_MAP} initialRegion={region}>{markers.map(v=><Marker key={String(v.park_id)} coordinate={{latitude:Number(v.latitude),longitude:Number(v.longitude)}} title={v.name} description={rateLabel(v.hourly_rate)} onPress={()=>setSelected(v)}/>)}</MapView>}
    </>}
    <Modal visible={!!selected} animationType="slide" onRequestClose={()=>setSelected(null)}><View style={s.container}><ScrollView contentContainerStyle={{padding:20,paddingTop:52,paddingBottom:60}}>
      <TouchableOpacity onPress={()=>setSelected(null)} style={{marginBottom:20}}><Ionicons name="arrow-back" size={25} color={COLORS.snow}/></TouchableOpacity>
      {photosOf(selected)[0] ? <Image source={{uri:photosOf(selected)[0]}} style={s.heroImage}/> : <View style={[s.imagePlaceholder,{height:190}]}><Ionicons name="football-outline" size={42} color={COLORS.primary}/></View>}
      <Text style={[s.headline,{marginTop:18}]}>{selected?.name}</Text>
      <Text style={s.muted}>{[selected?.city,selected?.state].filter(Boolean).join(', ') || 'Location details unavailable'}</Text>
      <Text style={[s.price,{fontSize:22,marginTop:18}]}>{rateLabel(selected?.hourly_rate)}</Text>
      <Text style={[s.muted,{marginTop:8}]}>Sports: {Array.isArray(selected?.sports)?selected.sports.join(', '):'Not listed'}</Text>
      {isVerified(selected) ? <View style={s.notice}><Ionicons name="shield-checkmark" size={21} color={COLORS.success}/><Text style={[s.muted,{flex:1,marginTop:0}]}>Verified by Grassroots. We confirmed the owner, location, price and photos.</Text></View> : <View style={s.notice}><Ionicons name="information-circle-outline" size={21} color={COLORS.primary}/><Text style={[s.muted,{flex:1}]}>This is a currently active legacy park listing, not yet a Grassroots owner-verified listing. Availability and reservations are not verified.</Text></View>}
      {[['Surface',selected?.surface],['Lights until',selected?.lights_until],['Parking',selected?.parking],['When to book',selected?.availability],['Field rules',selected?.rules]].filter(([,v])=>v).map(([k,v])=><View key={k} style={s.detailRow}><Text style={s.detailLabel}>{k}</Text><Text style={s.detailValue}>{v}</Text></View>)}
      <TouchableOpacity style={s.cta} onPress={()=>{const v=selected;setSelected(null);onCreateGame?.(v);}}><Text style={s.ctaText}>Create a game here</Text><Ionicons name="arrow-forward" size={18} color={COLORS.ink}/></TouchableOpacity>
      <TouchableOpacity style={s.secondaryCta} onPress={()=>{const v=selected;setSelected(null);onSelectPark?.(v);}}><Text style={s.secondaryCtaText}>View existing games</Text></TouchableOpacity>
    </ScrollView></View></Modal>
  </View>;
}
const s=StyleSheet.create({container:{flex:1,backgroundColor:COLORS.ink},header:{paddingHorizontal:20,paddingTop:45,paddingBottom:18},brand:{color:COLORS.primary,fontWeight:'900',fontSize:12,letterSpacing:2},headline:{color:COLORS.snow,fontWeight:'800',fontSize:27,marginTop:9},muted:{color:COLORS.mute,fontSize:13,marginTop:4},tabs:{flexDirection:'row',marginHorizontal:20,marginBottom:15,borderRadius:14,backgroundColor:COLORS.inkRaised,padding:4},tab:{flex:1,alignItems:'center',paddingVertical:11,borderRadius:10},activeTab:{backgroundColor:COLORS.primary},tabText:{color:COLORS.mute,fontWeight:'800'},activeTabText:{color:COLORS.ink},search:{flexDirection:'row',alignItems:'center',backgroundColor:COLORS.inkRaised,borderWidth:1,borderColor:COLORS.line,marginHorizontal:20,borderRadius:13,paddingHorizontal:13,height:48},input:{color:COLORS.snow,flex:1,marginLeft:8},chips:{paddingHorizontal:20,alignItems:'center',gap:8,paddingVertical:12},chip:{paddingVertical:8,paddingHorizontal:13,borderRadius:22,borderWidth:1,borderColor:COLORS.line},chipOn:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},chipText:{color:COLORS.snow,fontSize:12,fontWeight:'700'},chipTextOn:{color:COLORS.ink},row:{flexDirection:'row',gap:7,alignItems:'center'},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,marginBottom:12},smallChip:{borderWidth:1,borderColor:COLORS.line,borderRadius:18,paddingVertical:7,paddingHorizontal:10},smallChipOn:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},smallChipText:{color:COLORS.mute,fontSize:11,fontWeight:'700'},switch:{flexDirection:'row',alignItems:'center',gap:4,padding:8},switchText:{color:COLORS.primary,fontSize:12,fontWeight:'800'},list:{paddingHorizontal:20,paddingBottom:110},count:{color:COLORS.mute,fontSize:12,marginBottom:12},card:{borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.cardFill,borderRadius:18,overflow:'hidden',marginBottom:14},cardImage:{height:145,width:'100%'},imagePlaceholder:{height:135,alignItems:'center',justifyContent:'center',backgroundColor:COLORS.inkRaised,gap:8},cardBody:{padding:15},rowBetweenCard:{flexDirection:'row',justifyContent:'space-between'},cardTitle:{color:COLORS.snow,fontWeight:'800',fontSize:17},price:{color:COLORS.primary,fontSize:14,fontWeight:'800'},provisional:{color:COLORS.mute,fontSize:11,flex:1},verified:{color:COLORS.success,fontSize:12,fontWeight:'700'},detailRow:{marginTop:14},detailLabel:{color:COLORS.mute,fontSize:12},detailValue:{color:COLORS.snow,fontSize:15,marginTop:2},empty:{color:COLORS.mute,textAlign:'center',padding:25},heroImage:{height:200,width:'100%',borderRadius:18},notice:{flexDirection:'row',gap:10,padding:15,marginTop:20,borderRadius:15,borderWidth:1,borderColor:COLORS.line,backgroundColor:COLORS.inkRaised},cta:{marginTop:24,backgroundColor:COLORS.primary,borderRadius:15,padding:16,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:10},ctaText:{color:COLORS.ink,fontWeight:'900'},secondaryCta:{marginTop:10,borderColor:COLORS.line,borderWidth:1,borderRadius:15,padding:16,alignItems:'center'},secondaryCtaText:{color:COLORS.snow,fontWeight:'800'}});
