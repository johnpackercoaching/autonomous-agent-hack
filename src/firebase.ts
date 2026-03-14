import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  "projectId": "autonomous-agent-hack",
  "appId": "1:15535628185:web:f62001607f8baa1fddbd08",
  "storageBucket": "autonomous-agent-hack.firebasestorage.app",
  "apiKey": "AIzaSyDa-kX5jc84RnUFDcvBtUnnbX_7Bbh1IsI",
  "authDomain": "autonomous-agent-hack.firebaseapp.com",
  "messagingSenderId": "15535628185",
  "projectNumber": "15535628185",
  "databaseURL": "https://autonomous-agent-hack-default-rtdb.firebaseio.com",
  "version": "2"
}

const app = initializeApp(firebaseConfig)


export const db = getFirestore(app)
export const auth = getAuth(app)
export const storage = getStorage(app)
export const functions = getFunctions(app)
export const rtdb = getDatabase(app)
