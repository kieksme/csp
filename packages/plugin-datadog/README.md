# CSP Datadog Plugin

Lesende Datadog-Integration für Cases, Monitorstatus, SLOs über 30 Tage und On-Call-Schichten für sieben Tage. Getrennte Browser-/Server-Exporte; Zugangsdaten bleiben serverseitig. Die Demo benötigt keine Datadog-Verbindung.

[Einrichtung und API](../../docs/datadog.md) · [CSP-Wiki](https://github.com/kieksme/csp/wiki/datadog)

Live-Leseabnahme am 16. Oktober 2026: Monitore, SLO, Schichten/Team und ein leeres Case-Projekt im Acme-EU1-Testkonto erfolgreich geprüft. Befüllte Projekte, Statusfilter und Alarmzustellung sind noch nicht live abgenommen. Bearbeitung erfolgt über Links in Datadog.

WebMCP-Tools (nur lesend): `datadog_get_on_duty`, `datadog_get_oncall_schedule`, `datadog_list_monitors`, `datadog_list_slos`, `datadog_list_cases`. Veraltete Schichtdaten bestätigen nie eine Erreichbarkeit; Case-Texte tragen einen Hinweis auf externe Inhalte. Siehe [WebMCP](../../docs/webmcp.md).
