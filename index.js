import 'react-native-url-polyfill/auto';
import './src/lib/webAlert'; // makes Alert.alert work on the website

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);