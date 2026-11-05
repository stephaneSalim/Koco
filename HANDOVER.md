# KoCo — Dossier de passation (état au 5 novembre 2026)

> À lire en premier par toute IA ou tout développeur qui reprend KoCo.
> Ce fichier fait foi. Il remplace les anciens rapports de passation : un ancien
> « Dossier de Passation KoCo 2.0 » décrivait Next.js, Dify, OpenRouter et un
> script Python `koco_inject.py`, mais **rien de tout cela n'existe dans le code**.
> En cas de doute, vérifier dans le dépôt et dans la base, jamais dans un rapport.

---

## 1. Le projet en une page

**KoCo (Korean Cognitive Coach)** est une application d'apprentissage du coréen pilotée par IA.

- **Porteur et Product Owner** : Stéphane, doctorant GKS à Jeonbuk National University (JBNU), Jeonju. Francophone, il est aussi le premier utilisateur. Il a le dernier mot sur la direction du produit.
- **Statut** : projet personnel en pause de mai à novembre 2026. Il est relancé avec deux ambitions : en faire un outil pour **d'autres étudiants étrangers**, puis peut-être un produit.
- **Utilisateurs cibles** : étudiants et doctorants étrangers en Corée qui ont suivi une formation linguistique courte ou moyenne (souvent l'année GKS, avec un TOPIK 3 en sortie). Ils connaissent des règles de grammaire, mais ne les ont jamais pratiquées et ne savent pas *quand* les employer. Ils doivent faire des **présentations stressantes en classe ou en séminaire** (발표, registre académique, Q&A face aux professeurs).
- **Nouvelle direction (validée en principe)** : KoCo devient une **salle de répétition orale**. Il ne s'agit plus d'expliquer la grammaire, mais de la faire *produire*, sous une pression croissante, jusqu'à la vraie présentation. Voir la section 6.
- **URL de production** : https://kocoo.vercel.app
- **Dépôt** : https://github.com/stephaneSalim/Koco (branche par défaut `main`)

---

## 2. Stack réelle (vérifiée dans le code)

| Couche | Réalité |
|---|---|
| Front | HTML, CSS et JavaScript sans framework : `index.html`, `app.js` (≈3 800 lignes, monolithique), `api.js` (appels serveur et parsing des réponses de l'IA), `supabase.js` (client DB, Auth), `data.js` (données statiques), `style.css`. React n'est chargé (UMD + Babel CDN) que pour la Learning Map dans `index.html`. |
| Back | Fonctions serverless Vercel dans `api/*.js` (modules ES). `api/_lib/auth.js` est un module partagé, non exposé comme route. |
| Base | Supabase (Postgres). Projet `jxbqlphxsgglrlznpall`, offre gratuite : **mis en pause après environ 7 jours d'inactivité**. Il a été réactivé le 3 novembre 2026. |
| LLM | API Anthropic appelée directement, sans Dify ni OpenRouter pour le chat. Routage dans `api/chat.js` : `claude-haiku-4-5-20251001` par défaut, `claude-sonnet-4-6` pour les modes mission et debate, les messages longs et les erreurs récurrentes. Prompt caching et fenêtre glissante de 8 messages. |
| Vision/OCR | `api/analyze-image.js` utilise Claude Haiku Vision. C'est le chemin réellement utilisé. |
| OCR alternatif | `api/ocr-staging.js` passe par OpenRouter → `google/gemini-pro-1.5` (modèle probablement retiré). **Aucun bouton du front ne l'appelle** : code mort, mais deux lignes existent dans `lesson_content_staging`. |
| Voix | ElevenLabs. TTS dans `api/tts.js` (voix `sf8Bpb1IU97NI9BHSMRf`, modèle `eleven_multilingual_v2`), STT dans `api/stt.js`, en push-to-talk. |
| Script | `scripts/classify_gms.js` classe les phrases GMS par situation. Il exige la clé service_role, à garder en local uniquement. |
| Local | `server.js` (Express) ne connaît que `/api/chat` et `/api/tts`. Il faut préférer `vercel dev`. |

**Variables d'environnement Vercel** : `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY` (seulement pour ocr-staging), plus les quotas optionnels `QUOTA_CHAT`, `QUOTA_TTS`, `QUOTA_STT`, `QUOTA_ANALYZE_IMAGE`, etc. `SUPABASE_SERVICE_ROLE_KEY` ne sert qu'au script local.

**Règle de sécurité** : ne jamais demander ni coller de secret dans une conversation. L'IA modifie le code, Stéphane fait les réglages dans les tableaux de bord.

---

## 3. Fonctionnalités existantes (sur `main`)

- **Chat multi-modes** : `freeChat`, `speak`, `mission`, `daily_life`, `debate`. Les réponses de l'IA contiennent des blocs balisés que `api.js` analyse : `[CORRECTION]`, `[SPEAK_RESPONSE]`, `[MISSION_SCORE]`, `[DRILL_SESSION]`, `[GOLDEN_SENTENCE]`.
- **Sélecteur d'unités SNU** (서울대 한국어 3A→5B, 103 leçons), alimenté depuis `snu_units`.
- **OCR de pages de manuel** : une photo enrichit `lesson_content` pour l'unité active, avec fusion sans écrasement et plafond d'environ 300 mots.
- **Shadowing GMS** : TTS, puis STT, puis comparaison mot à mot avec la phrase cible.
- **Correction d'erreurs et répétition espacée** : les corrections alimentent `review_items`, avec intervalles et taux de réussite.
- **Distillateur** (`api/distill.js`) : transforme les erreurs en exercices (reconnaissance, rappel, production).
- **Missions** générées par unité (`api/generate-mission.js`), scénarios (`api/scenarios.js`), Knowledge Snapshot (`api/knowledge-snapshot.js`), Learning Map.

### Bugs et dettes connus (non corrigés)

1. **RAG cassé** : `supabase.js` appelle le RPC `search_global_context`, **qui n'existe pas dans la base**. L'appel échoue en silence et l'app se rabat sur les phrases GMS. Les pages de manuel photographiées ne sont donc jamais retrouvées par le chat.
2. Le même module filtre les mots de 2 caractères ou moins (`w.length > 2`), ce qui élimine une grande partie des mots coréens courants (병원, 은행, 버스…).
3. **Double écriture OCR** : `analyze-image` enregistre la fusion côté serveur, puis le front fusionne et enregistre une seconde fois. Le champ `theme` se concatène à chaque photo.
4. `get_knowledge_snapshot` (une fonction SQL avec décroissance temporelle, meilleure que le calcul JS) existe dans la base, mais **n'est pas appelée**. `api/knowledge-snapshot.js` refait le calcul à la main.
5. `generate-mission.js` utilise encore `claude-sonnet-4-20250514` : il faut aligner les modèles.
6. `supabase-schema.sql` et `README.md` sont **obsolètes**. La section 4 ci-dessous fait foi.
7. `app.js` est monolithique : il faut refactoriser par petites étapes, jamais d'un coup.

---

## 4. Base de données réelle (inventaire du 3 novembre 2026)

| Table | Lignes | Rôle et remarques |
|---|---:|---|
| `gms_sentences` | 3 000 | Corpus Glossika (kr, en, unité SNU, `situation_tag`, `speech_level`). **Actif précieux.** |
| `snu_units` | 103 | Leçons SNU 3A→5B (titres ko/en, `grand_theme_code`). **Actif précieux.** |
| `grand_themes` | 8 | Thèmes transversaux. |
| `lesson_content` | 13 | Contenu OCR par unité. Colonnes utilisées : `vocabulary`, `structures`, `context_snippets`, `theme`, `level`. Le schéma « V2 » a ajouté une vingtaine de colonnes (`vocab_nouns`, `vocab_verbs`, `structures_topik` jsonb, `typical_errors_by_language` jsonb, `communicative_functions`, `schema_version`…) que **le code n'utilise pas**. |
| `corrections` | 125 | Historique des erreurs de Stéphane. **Précieux** pour le jeu de test et la SRS. |
| `sessions` | 50 | Sessions de chat. |
| `review_items` | 45 | SRS : `interval_days`, `success_rate`, `drill_recognition/recall/production`, `is_recurring`, `error_pattern`… |
| `lesson_content_staging` | 2 | Staging de l'OCR Gemini (code mort). |
| `session_metrics` | 0 | Prévue pour MLU, connecteurs et score de mission. Vide : à exploiter pour les mesures. |
| `drill_sessions`, `shadowing_sessions` | 0 | Créées, jamais remplies. |
| `koco_users` | 0 | Profil (langue maternelle, `snu_level`, `campus_level`, `jbnu_status`, département). Vide. |
| `local_entities`, `campus_situations` | 0 | « Ancre campus JBNU » (lieux, phrases de survie multilingues). Vides. |
| `users`, `user_progress`, `levels`, `units`, `lessons`, `vocabulary_mastery`, `grammar_mastery`, `sentence_mastery` | 0 | Ancien schéma, avec `user_id` en uuid et RLS `auth.uid()`. Mort. `grammar_mastery` pourrait servir à P1. |

**Fonctions SQL** : `get_knowledge_snapshot(user_id_input text)`, non utilisée, et `handle_new_user()`, un trigger hérité qui insère dans `public.users`.
**Identifiants** : `user_id` est en **TEXT** dans les tables actives. Avant l'authentification, c'était un identifiant local du type `user_1776…`, stocké dans `localStorage`.

---

## 5. Travail en cours : sécurité (branche `secure/auth-rls`, non fusionnée)

**Problème corrigé** : sur `main`, tous les endpoints `/api/*` sont ouverts. N'importe qui peut consommer les crédits Anthropic et ElevenLabs. La base est lisible et modifiable par tous (clé anon publique + RLS `USING (true)`). La « clé API » demandée dans le navigateur n'était jamais vérifiée.

**Contenu de la branche** (commits `4748e8c`, `c578cfc`, `e65443d`) :
- `api/_lib/auth.js` : vérifie le JWT Supabase à chaque appel. Le `userId` vient du jeton, **jamais du body**. Un client Supabase est créé au nom de l'utilisateur, donc la RLS s'applique. Le module gère aussi un **quota journalier par utilisateur et par endpoint**, au jour de Séoul, via la table `api_usage`.
- Chat : liste blanche des modes, plafonds de taille (prompt système ≤ 40 000 caractères, message ≤ 4 000). STT : plafond audio. Les logs ne contiennent plus de préfixe de clé ni de transcript.
- Front : écran de connexion par lien magique ou **code à 6 chiffres** (`signInWithOtp` avec `shouldCreateUser: false`, donc bêta fermée sur invitation), jeton ajouté automatiquement aux appels `/api`, démarrage de l'app (`initApp`) seulement une fois connecté. La fenêtre de clé API est supprimée.
- `migrations/001_auth_rls.sql` : RLS `user_id = auth.uid()::text` sur les données personnelles, lecture seule pour les utilisateurs connectés sur le contenu partagé, table `api_usage`.
- `migrations/002_claim_legacy_data.sql` : rattache l'historique `user_1776…` au nouveau compte.

**Où on en est** :
- Supabase Auth est configuré : inscriptions fermées, Site URL, modèle d'e-mail avec `{{ .Token }}`.
- Le déploiement de prévisualisation affiche bien l'écran de connexion. Mais l'adresse e-mail de Stéphane est refusée (« n'est pas invitée ») : **son compte n'existe pas encore dans Authentication → Users**.
- Prochaine action : *Add user → Create new user*, en cochant **Auto Confirm User**.

**Séquence de mise en production, à respecter dans cet ordre** :
1. Créer le compte, puis le tester sur la prévisualisation avec le code à 6 chiffres.
2. Fusionner `secure/auth-rls` dans `main`.
3. Se connecter sur la production.
4. Exécuter `001_auth_rls.sql`. Entre la fusion et cette migration, le chat répond 503 `quota_unavailable`, ce qui est normal.
5. Exécuter `002`, étapes A → B → C.

Le service d'e-mail intégré à Supabase est limité à quelques envois par heure : il faudra brancher Resend (ou un service équivalent) avant d'inviter des testeurs.

---

## 6. Ce qu'on veut faire : la refonte « salle de répétition »

Le rapport de recherche complet, « Refonte de KoCo » (avec les sources), et la page visuelle des propositions ont été livrés à Stéphane. Résumé :

**Principe** : on ne demande plus « connais-tu cette règle ? », mais « peux-tu la dire, au bon interlocuteur, sous pression, puis la redire mieux ? ».

**Huit propositions**, en trois couches :

| | Proposition | Couche | Preuve | Effort |
|---|---|---|---|---|
| P1 | **Escalier de compétence** : chaque structure passe par trois marches (comprendre, produire avec du sens, utiliser librement), à l'oral. On passe d'une marche à l'autre sur la justesse **et** sur la latence. | Parcours | modérée | 6–9 j |
| P2 | **Cartes de contraste « quand utiliser quoi »** : -ㄹ 수 있다 (capacité ou atténuation), 에/에서, -아서/-니까, 합쇼체/해요체. L'utilisateur interprète d'abord, puis produit. | Parcours | modérée | 3–5 j |
| P3 | **Feedback en escalier** : 1 à 3 structures cibles par tâche. D'abord une incitation à se corriger, puis une correction explicite, puis une simple reformulation visible pour le hors-cible. Rapport en fin de session. Mode de correction au choix. | Moteur | **forte** | 4–6 j |
| P4 | **Rappel oral espacé** : chaque correction devient 2 ou 3 situations auxquelles répondre à voix haute. Les structures voisines sont mélangées, la latence est mesurée. | Moteur | modérée à forte | 3–5 j |
| P5 | **Studio 발표** : l'utilisateur importe son script, KoCo le segmente façon séminaire coréen, propose une banque de formules et la bascule de registre. Trois passages enregistrés, rapport de débit, pauses, remplissages, registre. Les métriques temporelles sont calculées **sans LLM**, à partir des horodatages du STT. | Studio | modérée | 12–18 j (version minimale 7–9 j) |
| P6 | **Simulateur de Q&A** : trois personas (선배, 교수님, 심사위원 sceptique) posent des questions tirées du script, avec 5 s de réflexion et 60 s de réponse. KoCo détecte les « mouvements » de réponse et propose une réponse modèle. | Studio | faible à modérée | 7–10 j |
| P7 | **Moniteur de registre et d'honorifiques** : chaque interlocuteur a un profil social. Un **filtre à règles d'abord** (말씀드리다/말씀하시다, 여쭤보다, 드리다, 계시다, 드시다…), Claude ensuite, avec un niveau de confiance. Une faible confiance s'affiche « à vérifier », jamais « faute ». | Moteur | faible à modérée | 6–9 j |
| P8 | **Échauffement de 4 minutes** : shadowing (GMS + script), exposé 3-2-1 minutes, phrase de recadrage « 설레요! ». **Aucun score de prononciation.** | Studio | faible | 2–4 j |

**Preuves clés** : le feedback correctif a un effet de d = 0,74, et de 0,97 en production libre ; les incitations (0,83) font mieux que les reformulations (0,53) (Lyster & Saito 2010). La répétition de tâche est soutenue par la méta-analyse d'Abdi Tabari et al. (2025). Les chatbots ont un effet d'environ g = 0,6, **sans effet démontré sur la fluidité et avec un plafond au niveau B1**. En Corée, les étudiants internationaux restent figés au 합쇼체 et emploient -ㄹ 수 있다 sans valeur d'atténuation (이윤덕 2026 ; 이혜경 2022), et réclament des présentations simulées (Lee & Kang 2025). **Aucune application étudiée** ne propose un parcours de préparation de présentation académique ni la correction des honorifiques.

**Trois risques à traiter dès la conception** :
1. **Exactitude du LLM sur les particules et les honorifiques**, mesurée par aucune étude. Réponse : un jeu de test de 200 à 300 énoncés tirés de `corrections`, annotés par un natif, relancé à chaque changement de prompt ou de modèle, et un bouton « je conteste ».
2. **STT sur un coréen accentué** : toujours montrer le transcript, le rendre modifiable, ne jamais pénaliser une erreur qui peut venir de la transcription.
3. **Effet de nouveauté et plafond B1** : une difficulté croissante, des récompenses à la production plutôt que des classements, des re-tests 2 à 4 semaines après.

---

## 7. Plan de route validé : livrer, tester, décider

**Règles** :
- Une branche par étape, testée sur la prévisualisation Vercel avant fusion.
- Stéphane teste d'abord sur ses vraies présentations, puis 3 à 5 testeurs.
- Chaque étape a un critère de réussite fixé à l'avance.
- Mesures enregistrées dans `session_metrics` dès l'étape 1.

| Étape | Contenu | Critère de réussite |
|---|---|---|
| **0. Base saine** (~1 sem.) | Finir et fusionner `secure/auth-rls`, migrations 001 et 002. Ping quotidien anti-pause de Supabase. Envoi d'e-mails via Resend. Jeu de test de 200 à 300 phrases annotées. Idéalement : corriger le RAG (`search_global_context`) et la double écriture OCR. | Connexion OK, historique rattaché, un testeur invité peut entrer, isolation des données vérifiée. |
| **1. P3 Feedback en escalier** (~1 sem.) | Cibles par mission, machine à états du feedback, rapport JSON de fin de session. | < 10 % de fausses corrections sur le jeu de test ; Stéphane trouve le feedback plus utile après une semaine. |
| **2. P4 Rappel oral** (~1 sem.) | Situations générées depuis `corrections`, réponse orale, latence. | Utilisé au moins 5 jours sur 7 pendant 2 semaines ; latence en baisse sur les items revus. |
| 🚩 **Décision 1** | | Inviter les 3 à 5 premiers testeurs. |
| **3. P5 Studio, version minimale** (~2 sem.) | Texte collé, segmentation, formules, 3 passages, rapport chiffré. Testé sur une **vraie présentation**. | Moins de pauses longues et de ruptures de registre entre le passage 1 et le passage 3 ; anxiété en baisse (5 questions avant et après). |
| **4. P6 Q&A** (~1,5 sem.) | Trois personas, questions tirées du script, détection des mouvements de réponse. | Le testeur reconnaît en vraie séance au moins un type de question entraîné. |
| 🚩 **Décision 2** | | Le Studio aide-t-il vraiment ? Si oui, approfondir et envisager le produit. Sinon, revoir le concept. |
| **5. P2 + P7** (~2 sem.) | Contrastes à partir des vraies erreurs, honorifiques avec règles et confiance. | Aucune fausse « faute » d'honorifique sur le jeu de test. |
| **6. P1 + P8 + bêta élargie** (~2 sem.) | Escalier (structures académiques d'abord), échauffement en A/B, idée « chapitres 6B → leçons générées », re-tests différés, 15 à 20 testeurs. | Gains toujours présents au re-test à 2–4 semaines. |

Durée totale estimée : 10 à 12 semaines, en parallèle de la thèse. **Caler les étapes 3 et 4 sur une vraie date de présentation de Stéphane.**

---

## 8. Décisions prises et choses à ne pas faire

- ✅ KoCo est destiné à d'autres étudiants, d'où le choix d'une vraie authentification (Supabase Auth) plutôt qu'un code d'accès partagé.
- ✅ Bêta fermée sur invitation (`shouldCreateUser: false`).
- ✅ Les secrets restent dans Vercel et Supabase. L'IA ne les demande jamais.
- ✅ Approche incrémentale : une décision à la fois, pas de refactoring massif non demandé, toute modification passe par une branche et une prévisualisation.
- ✅ Les métriques de fluidité (débit, pauses) sont calculées de façon déterministe, pas par le LLM.
- ❌ Pas de score global de prononciation : jugé non fiable partout.
- ❌ Pas de classements ni de ligues : un public adulte, et un risque de « dark patterns ».
- ❌ Pas de décompilation ni de rétro-ingénierie d'applications concurrentes (contrats de licence, risque pour le futur produit). Rosetta Stone, Speak et les autres s'étudient **en boîte noire** : usage normal, protocole de test, sources publiques et brevets.
- ⏸️ Hébergement : on reste sur Vercel et Supabase en offre gratuite tant que le code n'est pas propre. On reconsidère ce choix plus tard.
- ⏸️ Les tables V2 vides (`local_entities`, `campus_situations`, `koco_users`, colonnes V2 de `lesson_content`) ne sont pas supprimées. Elles seront utilisées ou retirées pendant la refonte (P7 peut utiliser `koco_users`).

---

## 9. Pour démarrer une session de travail

1. Lire ce fichier, puis `Koco-manifest.md`, qui décrit l'architecture applicative et reste globalement fidèle au code.
2. `git fetch` et regarder l'état de `secure/auth-rls` par rapport à `main`.
3. Demander à Stéphane où il en est de l'étape 0 : compte créé ? branche fusionnée ? migrations lancées ?
4. Pour inspecter la base, faire exécuter par Stéphane des requêtes SQL **une par une** dans le SQL Editor. Il exporte le résultat en CSV, limité à 100 lignes par export. Pour compter les lignes, utiliser `count(*)` et non `pg_stat_user_tables`, qui revient à 0 après la réactivation du projet.
5. Communiquer en français, avec des étapes concrètes pour le tableau de bord, en indiquant où cliquer.
