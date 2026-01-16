// app/index.tsx
import { Redirect } from "expo-router";
import { useEffect } from "react";
import { initDB } from "../src/database/db";

export default function Index() {
  useEffect(() => {
    // Initialiser la base de données au démarrage
    const initDatabase = async () => {
      try {
        await initDB();
        console.log('✅ Database initialized');
      } catch (error) {
        console.error('❌ Failed to initialize database:', error);
      }
    };
    
    initDatabase();
  }, []);

  return <Redirect href="/login" />;
}