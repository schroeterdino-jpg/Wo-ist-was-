export default async function handler(req, res) {
    // 1. Nur POST-Anfragen erlauben
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 2. Zugriffsschutz (Optional, aber dringend empfohlen)
    // Wenn in Vercel die Variable API_SECRET_KEY gesetzt ist, wird dieser Header geprüft.
    const clientSecret = req.headers['x-api-secret'];
    if (process.env.API_SECRET_KEY && clientSecret !== process.env.API_SECRET_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { text, contextData } = req.body;
    
    // 3. Groq API-Key prüfen
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY ist auf Vercel nicht gesetzt.' });
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "openai/gpt-oss-120b",
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: `Du bist ${contextData?.userName || 'Dino'}s smarter, persönlicher Alltags-Assistent. 
                        Aktueller Daten-Kontext: ${JSON.stringify(contextData)}.
                        
                        WICHTIG ZUR ZEIT & DATUM:
                        - Aktuelles Datum und deutsche Ortszeit: ${contextData?.heute_datum || ''}.
                        - Berücksichtige bei Datums- und Zeitangaben immer die deutsche Zeitzone (Europe/Berlin).
                        
                        Analysiere den Sprachbefehl des Benutzers und unterscheide PRÄZISE:
                        
                        STRIKTE CATEGORY-REGELN:
                        - "forgot_check": Wenn der Benutzer fragt, ob er etwas vergessen hat. Prüfe überfällige/aktive Erinnerungen, anstehende Termine, offene Aufgaben, Einkaufsliste und wichtige Dinge im Gedächtnis und fass diese präzise in 'reply' zusammen.
                        - "chat": Fragen nach Inhalten aus den Listen (z. B. "Was steht auf meiner Einkaufsliste?").
                        - "shopping": Wenn der Benutzer NEUE Artikel zur Einkaufsliste HINZUFÜGEN möchte.
                        - "todo": Für alle Aufgaben ODER Notizen/Gedanken.
                        - "memory_store": Ausschließlich für feste Fakten, Standorte von Gegenständen oder persönliches Wissen zum SPEICHERN.
                        - "memory_search": Wenn der Benutzer nach gespeicherten Informationen, Fakten, Orten oder Dingen im Gedächtnis fragt.
                        - "calendar_delete": Wenn der Benutzer einen Termin LÖSCHEN möchte.
                        - "reminder_delete": Wenn der Benutzer eine Erinnerung löschen möchte.
                        - "name_change": Wenn der Benutzer sagt, wie er genannt werden möchte.
                        - "location": Fragen nach dem aktuellen physischen Standort.
                        - "reminder": Neue zeitgesteuerte Erinnerung anlegen.
                        - "calendar": Neuer fester Kalender-Termin anlegen.
                        - "call": Telefonanruf starten.

                        MEHRSPRACHIGKEIT:
                        - Antworte immer in der Sprache des Benutzers.

                        Gib IMMER ein valides JSON-Objekt zurück mit:
                        - type: "forgot_check", "chat", "location", "memory_store", "memory_search", "todo", "calendar", "calendar_delete", "reminder", "reminder_delete", "shopping", "call", "name_change"
                        - new_name
                        - memory_key, memory_value, memory_search_query
                        - todo_items, shopping_items, reminder_text, reminder_time, calendar_text, calendar_time, call_contact
                        - calendar_delete_query
                        - reminder_delete_query
                        - reply: Natürliche, grammatikalisch einwandfreie Antwort.`
                    },
                    { role: "user", content: text }
                ]
            })
        });

        // 4. HTTP-Status der Groq-Antwort prüfen
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json({ 
                error: 'Fehler von der Groq-API', 
                details: errorData 
            });
        }

        const data = await response.json();
        
        // 5. Raw-Content aus den OpenAI/Groq Choices extrahieren
        const rawContent = data?.choices?.[0]?.message?.content;

        if (!rawContent) {
            return res.status(500).json({ error: 'Keine Antwort im Groq-Payload gefunden.' });
        }

        // 6. JSON-String parsen und direkt als fertiges Objekt an das Frontend liefern
        const parsedData = JSON.parse(rawContent);
        return res.status(200).json(parsedData);

    } catch (error) {
        console.error("Groq API Handler Error:", error);
        return res.status(500).json({ error: 'Server-Fehler bei der Verarbeitung der Anfrage' });
    }
}
