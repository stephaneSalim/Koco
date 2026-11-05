# P3 — Feedback en escalier : spécification de conception

Statut : **brouillon à valider par Stéphane** · Branche : `feat/p3-feedback-escalier` (partie de `secure/auth-rls`)
Sources : rapport « Refonte de KoCo » (Lyster & Saito 2010 ; Mackey & Goo 2007 ; Bibauw et al. 2022). Paramètres propres à KoCo, réglables après les tests.

## 1. Ce qui existe aujourd'hui (constaté dans le code)

- Chaque réponse de Claude contient un bloc `[CORRECTION]` avec STATUS, ORIGINAL, FIXED et NOTE. `app.js > parseCorrection()` le lit, puis `addCorrectionBlock()` **affiche immédiatement la forme corrigée**, quelle que soit l'erreur.
- Le mode `mission` utilise un « BLOCKING PROTOCOL » : en cas d'erreur, il donne tout de suite la forme à utiliser. Le mode `speak` donne un NATIVE_POLISH, c'est-à-dire une reformulation, et ne fait jamais appel à l'autocorrection.
- Les cibles existent déjà : `missionCfg.target_grammar`, au maximum 5, plus les `weak_points` venant de `review_items`. Elles ne pilotent pas le *type* de feedback.
- La transcription vocale est envoyée directement. L'utilisateur ne peut pas corriger une transcription fausse, qui est alors comptée comme une erreur.
- `corrections.error_type` reçoit en fait la NOTE explicative. Il n'y a aucune trace du type de feedback reçu ni de l'autocorrection.

## 2. Comportement cible

**Cibles de la session** : au maximum 3 structures, affichées en haut du chat sous forme de pastilles. On les prend dans l'ordre suivant : les `weak_points` de l'unité, puis les `target_grammar` de la mission, puis les 2 premières `structures` de `lesson_content`.

**L'escalier, par structure cible :**

| Situation | Ce que fait Claude (dans son rôle) | Ce que montre l'écran | Ce qui est enregistré |
|---|---|---|---|
| 1ʳᵉ erreur sur une cible | **Relance** : une demande de clarification ou un indice, *sans donner la forme* | Une pastille « 🤔 Essaie de te corriger », sans la forme corrigée | Rien de définitif. L'échelon de cette cible passe à 1. |
| L'utilisateur se corrige au tour suivant | Une validation brève, puis la conversation continue | « ✅ Corrigé par toi-même » | `self_repaired = true`, et l'échelon revient à 0 |
| 2ᵉ erreur sur la même cible | **Correction explicite** : la règle en une ligne | Une bulle règle avec la correction surlignée (barré → vert) et un bouton « 🎙 Répéter à voix haute » | Une correction de type `explicit`, qui part dans `review_items` |
| Répétition après la correction explicite | Rien. C'est vérifié côté client, en comparant la transcription à FIXED. | ✓ si la répétition est proche, sinon « encore une fois » (2 essais au maximum, sans blocage) | Le résultat de la répétition |
| Erreur hors cible | **Reformulation** intégrée dans sa réplique, sans interrompre | Une petite ligne repliée « reformulation : … » | `recast`, regroupé dans le rapport de fin |
| Confiance faible de Claude | Pas de correction affirmée | « ⚠️ À vérifier », jamais « faute » | Rien n'est enregistré comme erreur |
| Transcription vocale suspecte | « Je n'ai pas bien entendu, tu peux redire ? » | Un bouton « ✏️ Corriger ma transcription » sur la bulle de l'utilisateur | Rien. La tentative n'est pas comptée. |

**Règles fixes :**
- On ne saute jamais une étape automatiquement : après une correction explicite, la conversation continue normalement.
- Pas de minuteur imposé. La latence (fin de la voix de KoCo → début de l'enregistrement) est **mesurée** et enregistrée pour P1 et P4, jamais utilisée pour sanctionner.
- Le mode de correction se choisit dans les réglages : **discret** (uniquement des reformulations, pour la conversation libre), **normal** (l'escalier, par défaut) ou **strict** (la correction explicite dès la 2ᵉ erreur, même hors cible).
- Le mode `freeChat` reste en *discret* par défaut. L'escalier s'applique à `mission`, `speak`, `daily_life` et `debate`.

## 3. Rapport de fin de session

Il s'affiche quand on clique sur Stop (`openSessionSummary`) :
- pour chaque cible : utilisée correctement ×n, autocorrigée ×n, corrigée explicitement ×n ;
- les 3 points à retravailler, choisis en priorité parmi les corrections explicites ;
- 2 de ses phrases, dans une version « améliorée » ;
- le transcript complet, repliable.

## 4. Implémentation (sans changement de schéma)

**Contrat avec Claude.** Le bloc `[CORRECTION]` gagne des champs facultatifs. Les anciens champs restent, donc l'ancien parseur continue de marcher :
```
[CORRECTION]
STATUS: correct|minor|major
ORIGINAL: …
FIXED: …
NOTE: …
TARGET: <structure cible concernée | NONE>
FEEDBACK: prompt|explicit|recast|none
CONFIDENCE: high|low
STT_SUSPECT: yes|no
[/CORRECTION]
```
- À chaque tour, le client injecte dans le prompt un bloc `FEEDBACK LADDER STATE`, du type « -는 것으로 나타나다 : échelon 1 → la prochaine erreur appelle une correction explicite ». Claude sait ainsi quoi faire, mais **c'est le client qui décide de l'affichage** : si Claude donne la forme corrigée trop tôt, l'écran la masque quand même.
- Le module est nouveau : `feedback-ladder.js`, une machine à états pure, testable sans navigateur. `app.js` ne fait que l'appeler.
- Le BLOCKING PROTOCOL du mode `mission` et le NATIVE_POLISH du mode `speak` sont réécrits pour respecter l'escalier.

**Données, sans migration :**
- `corrections` : on y insère seulement les corrections `explicit` et les erreurs répétées. La NOTE garde sa place actuelle.
- `session_metrics` (vide aujourd'hui, toutes les colonnes existent déjà) : une ligne par session, avec `target_grammar_used` (jsonb, statistiques par cible : utilisée, autocorrigée, explicite), `mlu_detail` (jsonb : latences, nombre de transcriptions corrigées, mode de correction), `total_messages` et `total_words`.
- `review_items` : les corrections explicites y entrent par le chemin existant (`saveReviewItems`).

## 5. Comment on teste (critères de l'étape 1)

1. **Tests unitaires** de `feedback-ladder.js` : toutes les transitions du tableau ci-dessus.
2. **Jeu de test** (à construire avec Stéphane) : 200 à 300 phrases tirées des 125 `corrections`, annotées par un natif. Un script envoie chaque phrase à Claude avec le prompt P3 et mesure le taux de fausses corrections. **Objectif : moins de 10 %.**
3. **Usage réel** : une semaine de missions par Stéphane sur la prévisualisation. On compare le taux d'autocorrection et son ressenti par rapport à avant.

## 6. Hors périmètre de P3

Le moniteur d'honorifiques (P7), le rappel oral (P4), qui consomme les données produites ici, l'escalier par unité (P1) et toute modification du schéma Supabase.
