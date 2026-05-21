-- ============================================================
-- LIFE CHRONICLE — Seed Data
-- Runs on: supabase db reset (local) or after schema migration
-- Idempotent: all inserts use ON CONFLICT DO NOTHING
-- ============================================================


-- ============================================================
-- LIFE DIMENSIONS
-- The 10 WisdomTopicSort domains — top-level dimensions under
-- the 'topic_domain' dimension type. Seeded once globally;
-- owned by no user (user_id = null is acceptable for taxonomy
-- rows that the system provides, referenced by questions and
-- coverage tracking).
--
-- is_sensitive = true → memories tagged with this dimension
-- auto-default to privacy isolation (auto_isolate card grant).
-- ============================================================

WITH topic_type AS (
    SELECT id FROM dimension_types WHERE code = 'topic_domain'
)
INSERT INTO dimensions (type_id, code, name, description, is_sensitive, sort_order)
SELECT
    t.id,
    d.code,
    d.name,
    d.description,
    d.is_sensitive,
    d.sort_order
FROM topic_type t
CROSS JOIN (VALUES
    ('self_identity',        'Self & Identity',        'Who you are: personality, self-concept, values, and sense of self across time.',                     false, 1),
    ('relationships_family', 'Relationships & Family', 'The people who shaped and accompanied your life: family, friends, partners, mentors.',               false, 2),
    ('career_vocation',      'Career & Vocation',      'Work, profession, calling, and economic life across your career arc.',                               false, 3),
    ('health_body',          'Health & Body',          'Physical and mental health, illness, recovery, fitness, and relationship with your body.',           true,  4),
    ('home_place',           'Home & Place',           'The places you lived, loved, and left — and how geography shaped your identity.',                    false, 5),
    ('learning_mind',        'Learning & Mind',        'Education, intellectual growth, skills developed, and the arc of your thinking.',                    false, 6),
    ('beliefs_values',       'Beliefs & Values',       'Spiritual, religious, philosophical, and ethical convictions — how they formed and evolved.',        true,  7),
    ('creative_play',        'Creative & Play',        'Hobbies, artistic expression, sport, play, and the life of imagination.',                            false, 8),
    ('community_world',      'Community & World',      'Your relationship with community, society, culture, politics, and the wider world.',                  false, 9),
    ('transitions_endings',  'Transitions & Endings',  'Losses, deaths, endings, and the major turning points that divided your life into chapters.',         false, 10)
) AS d(code, name, description, is_sensitive, sort_order)
ON CONFLICT DO NOTHING;


-- ============================================================
-- LIFE STAGES
-- Temporal arc dimensions under the 'life_stage' type.
-- Used as coarse temporal anchors and swim-lane labels on the
-- timeline. Ordered chronologically.
-- ============================================================

WITH stage_type AS (
    SELECT id FROM dimension_types WHERE code = 'life_stage'
)
INSERT INTO dimensions (type_id, code, name, description, is_sensitive, sort_order)
SELECT
    t.id,
    d.code,
    d.name,
    d.description,
    false,
    d.sort_order
FROM stage_type t
CROSS JOIN (VALUES
    ('early_childhood', 'Early Childhood', 'Birth to approximately age 5',                                   1),
    ('childhood',       'Childhood',       'Ages 6–11: school years, early friendships',                    2),
    ('adolescence',     'Adolescence',     'Ages 12–17: identity formation, secondary school',              3),
    ('young_adult',     'Young Adulthood', 'Ages 18–29: independence, education, early career',             4),
    ('early_midlife',   'Early Midlife',   'Ages 30–44: career building, family formation, establishment',  5),
    ('midlife',         'Midlife',         'Ages 45–59: peak career, mid-life reflection, transition',      6),
    ('later_life',      'Later Life',      'Ages 60–74: retirement, legacy, shifting roles',                7),
    ('elderhood',       'Elderhood',       'Ages 75+: wisdom, reflection, end-of-life perspective',         8)
) AS d(code, name, description, sort_order)
ON CONFLICT DO NOTHING;


-- ============================================================
-- INTERVIEW QUESTIONS
-- 5 questions per topic_domain dimension, depth 1–5.
-- Used by the Planner and Capture Agents to drive interviews.
--
-- depth_level:
--   1 = surface opener  (comfortable, easy to answer)
--   2 = mid-depth
--   3 = reflective / slightly vulnerable
--   4 = deep / emotionally significant
--   5 = transformative / rare
-- ============================================================

-- Self & Identity
INSERT INTO questions (dimension_id, text, depth_level, sort_order)
SELECT d.id, q.text, q.depth_level, q.sort_order
FROM dimensions d
JOIN dimension_types dt ON dt.id = d.type_id
CROSS JOIN (VALUES
    ('How would you describe yourself to someone who has never met you?',                                                    1, 1),
    ('What aspect of your personality are you most proud of?',                                                               2, 2),
    ('Has your sense of who you are changed significantly at any point in your life? What happened?',                        3, 3),
    ('What do you believe your purpose in life is, or has been?',                                                            4, 4),
    ('If you could send one piece of wisdom back to your younger self, what would it be?',                                   4, 5)
) AS q(text, depth_level, sort_order)
WHERE dt.code = 'topic_domain' AND d.code = 'self_identity'
ON CONFLICT DO NOTHING;

-- Relationships & Family
INSERT INTO questions (dimension_id, text, depth_level, sort_order)
SELECT d.id, q.text, q.depth_level, q.sort_order
FROM dimensions d
JOIN dimension_types dt ON dt.id = d.type_id
CROSS JOIN (VALUES
    ('Tell me about your family — who were the key people in your household growing up?',                                    1, 1),
    ('Who has been the most important person in your life so far, and why?',                                                 2, 2),
    ('Describe a friendship that shaped you in a significant way.',                                                          2, 3),
    ('Has there been a relationship — romantic, family, or friendship — that ended and still matters to you?',               3, 4),
    ('What did you learn about love and connection from the people around you?',                                             4, 5)
) AS q(text, depth_level, sort_order)
WHERE dt.code = 'topic_domain' AND d.code = 'relationships_family'
ON CONFLICT DO NOTHING;

-- Career & Vocation
INSERT INTO questions (dimension_id, text, depth_level, sort_order)
SELECT d.id, q.text, q.depth_level, q.sort_order
FROM dimensions d
JOIN dimension_types dt ON dt.id = d.type_id
CROSS JOIN (VALUES
    ('What was your first job, and what do you remember about it?',                                                          1, 1),
    ('Walk me through the arc of your working life — the main roles or chapters.',                                           2, 2),
    ('What piece of work are you most proud of?',                                                                            2, 3),
    ('Was there a moment when you felt you had found your calling — or realised you had taken the wrong path?',              3, 4),
    ('What did your career teach you about who you are?',                                                                    4, 5)
) AS q(text, depth_level, sort_order)
WHERE dt.code = 'topic_domain' AND d.code = 'career_vocation'
ON CONFLICT DO NOTHING;

-- Health & Body
INSERT INTO questions (dimension_id, text, depth_level, sort_order)
SELECT d.id, q.text, q.depth_level, q.sort_order
FROM dimensions d
JOIN dimension_types dt ON dt.id = d.type_id
CROSS JOIN (VALUES
    ('How would you describe your relationship with your health over the years?',                                            1, 1),
    ('Has illness — your own or someone close to you — been a significant part of your story?',                             2, 2),
    ('Has your body surprised you — positively or negatively — at any point in your life?',                                 3, 3),
    ('How has your sense of physical self changed as you have grown older?',                                                 3, 4),
    ('Have you ever had to reckon with your own mortality? What happened?',                                                  5, 5)
) AS q(text, depth_level, sort_order)
WHERE dt.code = 'topic_domain' AND d.code = 'health_body'
ON CONFLICT DO NOTHING;

-- Home & Place
INSERT INTO questions (dimension_id, text, depth_level, sort_order)
SELECT d.id, q.text, q.depth_level, q.sort_order
FROM dimensions d
JOIN dimension_types dt ON dt.id = d.type_id
CROSS JOIN (VALUES
    ('Where did you grow up, and what was it like?',                                                                         1, 1),
    ('What places have you lived, and roughly when?',                                                                        1, 2),
    ('Is there one place — a home, a city, a landscape — that feels most like "yours"?',                                    2, 3),
    ('Has moving ever changed who you are?',                                                                                 3, 4),
    ('Are there places you left that you still grieve for, or places that unexpectedly became home?',                        4, 5)
) AS q(text, depth_level, sort_order)
WHERE dt.code = 'topic_domain' AND d.code = 'home_place'
ON CONFLICT DO NOTHING;

-- Learning & Mind
INSERT INTO questions (dimension_id, text, depth_level, sort_order)
SELECT d.id, q.text, q.depth_level, q.sort_order
FROM dimensions d
JOIN dimension_types dt ON dt.id = d.type_id
CROSS JOIN (VALUES
    ('What was school like for you — the overall experience?',                                                               1, 1),
    ('What subjects, skills, or fields of knowledge have you been most drawn to across your life?',                         2, 2),
    ('Has a book, teacher, or idea ever genuinely changed the way you see the world?',                                       3, 3),
    ('Where has your most important learning taken place — formal education, or somewhere else?',                            3, 4),
    ('What do you still feel you have left to learn or understand?',                                                         4, 5)
) AS q(text, depth_level, sort_order)
WHERE dt.code = 'topic_domain' AND d.code = 'learning_mind'
ON CONFLICT DO NOTHING;

-- Beliefs & Values
INSERT INTO questions (dimension_id, text, depth_level, sort_order)
SELECT d.id, q.text, q.depth_level, q.sort_order
FROM dimensions d
JOIN dimension_types dt ON dt.id = d.type_id
CROSS JOIN (VALUES
    ('Were you raised with a particular religious or spiritual tradition?',                                                   1, 1),
    ('How would you describe your beliefs today — spiritual, religious, philosophical, or otherwise?',                       2, 2),
    ('Has there been a moment of genuine doubt, crisis of faith, or major shift in your beliefs?',                           3, 3),
    ('What do you believe about what happens after we die?',                                                                 4, 4),
    ('What is the most important thing you believe, and how did you come to believe it?',                                    5, 5)
) AS q(text, depth_level, sort_order)
WHERE dt.code = 'topic_domain' AND d.code = 'beliefs_values'
ON CONFLICT DO NOTHING;

-- Creative & Play
INSERT INTO questions (dimension_id, text, depth_level, sort_order)
SELECT d.id, q.text, q.depth_level, q.sort_order
FROM dimensions d
JOIN dimension_types dt ON dt.id = d.type_id
CROSS JOIN (VALUES
    ('What did you love to do for fun as a child?',                                                                          1, 1),
    ('Do you have hobbies or creative pursuits that have been important to you at any point?',                               1, 2),
    ('Has creativity — making, building, performing, writing — played a significant role in your life?',                    2, 3),
    ('Is there something you used to do that brought you joy but you have stopped? What happened?',                         3, 4),
    ('What does play or creative expression mean to you?',                                                                   4, 5)
) AS q(text, depth_level, sort_order)
WHERE dt.code = 'topic_domain' AND d.code = 'creative_play'
ON CONFLICT DO NOTHING;

-- Community & World
INSERT INTO questions (dimension_id, text, depth_level, sort_order)
SELECT d.id, q.text, q.depth_level, q.sort_order
FROM dimensions d
JOIN dimension_types dt ON dt.id = d.type_id
CROSS JOIN (VALUES
    ('What communities have you been part of — neighbourhood, religious, professional, online?',                             1, 1),
    ('Have world events — wars, recessions, political upheaval, pandemics — directly touched your life?',                   2, 2),
    ('Have you ever been involved in a cause, movement, or form of public service?',                                         2, 3),
    ('How has the world changed in your lifetime in ways that feel most personal to you?',                                   3, 4),
    ('What do you owe the communities and societies that shaped you, and have you paid it?',                                 5, 5)
) AS q(text, depth_level, sort_order)
WHERE dt.code = 'topic_domain' AND d.code = 'community_world'
ON CONFLICT DO NOTHING;

-- Transitions & Endings
INSERT INTO questions (dimension_id, text, depth_level, sort_order)
SELECT d.id, q.text, q.depth_level, q.sort_order
FROM dimensions d
JOIN dimension_types dt ON dt.id = d.type_id
CROSS JOIN (VALUES
    ('What have been the biggest turning points in your life?',                                                              2, 1),
    ('Tell me about a significant loss you have experienced — a person, a chapter, a way of life.',                         3, 2),
    ('Has there been an ending in your life that unexpectedly led to something good?',                                       3, 3),
    ('How do you relate to endings — do they come easily or are they hard for you?',                                         4, 4),
    ('When you think about the final chapter of your life, what comes to mind?',                                             5, 5)
) AS q(text, depth_level, sort_order)
WHERE dt.code = 'topic_domain' AND d.code = 'transitions_endings'
ON CONFLICT DO NOTHING;
