# Leads Intelligence Architecture

## Objetivo
Blindar la arquitectura de inteligencia de Leads para que el comportamiento operativo sea consistente, determinista y escalable sin mezclar responsabilidades.

## Fronteras de responsabilidad

### 1) `config/leads-intelligence.ts` (declarativo)
- Define reglas declarativas (`leadAutomationRules`).
- Define llaves de persistencia (`LEADS_INTELLIGENCE_STORAGE_KEYS`).
- **No** ejecuta cálculo derivado ni lógica temporal.

### 2) `lib/leads/intelligence.ts` (lógica derivada única)
- Punto único de derivación: `getLeadIntelligence(lead, { now? })`.
- Produce `LeadIntelligence` con score, urgencia, sugerencia, tonos y señales.
- Acepta `now` opcional para evaluación determinista (tests/simulaciones).
- `getAutomationPayloadForLead` consume `LeadIntelligence` ya calculada.

### 3) UI (`components/leads/leads-list.tsx`) (presentación/orquestación)
- Renderiza información y maneja eventos de usuario.
- Consume `LeadIntelligence` precomputada.
- **No** replica reglas de score/urgencia/sugerencias ni lógica de evaluación temporal.

### 4) Automation (aplicación de reglas)
- Usa reglas declarativas de `config`.
- Usa señales calculadas en `LeadIntelligence`.
- Evita recalcular condiciones para prevenir drift entre UI y ejecución.

## Flujo recomendado
1. UI obtiene `LeadIntelligence` por lead.
2. UI renderiza score, badges y sugerencias sin recalcular.
3. En acciones automatizadas, `getAutomationPayloadForLead` usa:
   - reglas declarativas (`leadAutomationRules`)
   - estado habilitado (`enabledRules`)
   - `LeadIntelligence` del lead
4. Persistencia de preferencias queda limitada a storage keys de config.

## Reglas de diseño
- **Single derivation contract:** toda señal operativa por lead sale de `getLeadIntelligence`.
- **Determinismo explícito:** cuando haya contexto temporal sensible, inyectar `now`.
- **Config sin ejecución:** config declara, intelligence calcula.
- **UI sin negocio:** UI muestra y dispara acciones; no interpreta reglas.

## Riesgos conocidos
- Evaluaciones temporales cercanas al límite (ej. “vence hoy”) pueden cambiar entre ciclos de render cuando se usa `Date.now()` implícito.
- `getAutomationPayloadForLead` mantiene una condición de estado (`lead.status === 'nuevo'`) por seguridad de transición; si cambian reglas de negocio, debe versionarse junto con reglas declarativas.
