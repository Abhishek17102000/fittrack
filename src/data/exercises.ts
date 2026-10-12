import type { Exercise } from '../types'

type Seed = Omit<Exercise, 'measure' | 'type'> & Partial<Pick<Exercise, 'measure' | 'type'>>

// Defaults first so a seed can override (e.g. a timed exercise declared via S()).
const E = (type: Exercise['type'], measure: Exercise['measure'], e: Seed): Exercise => ({ type, measure, ...e })
const S = (e: Seed) => E('strength', 'reps', e)
const T = (type: Exercise['type'], e: Seed) => E(type, 'time', e)

export const EXERCISES: Exercise[] = [
  // ───────── Warm-up ─────────
  T('cardio', {
    id: 'bike_easy', name: 'Easy Bike / Rower', muscles: ['Full body'],
    steps: ['Set the seat so your knee is slightly bent at the bottom of the pedal stroke.', 'Pedal (or row) at a pace where you could chat easily.', 'Let your heart rate rise gradually; you should feel warm, not tired.'],
    tips: ['Keep your shoulders relaxed.', 'This is only a warm-up - save the effort for the main work.'],
    mistakes: ['Going too hard and arriving at the main lifts already tired.'],
    query: 'gym warm up stationary bike how to',
  }),
  S({
    id: 'bodyweight_squat', name: 'Bodyweight Squat', muscles: ['Quads', 'Glutes'],
    steps: ['Stand with feet shoulder-width apart, toes slightly out.', 'Push your hips back and bend your knees, lowering until thighs are about parallel.', 'Drive through the whole foot to stand back up.'],
    tips: ['Keep your chest tall and eyes forward.', 'Push your knees out in line with your toes.'],
    mistakes: ['Knees caving inward.', 'Heels lifting off the floor.'],
    harderId: 'goblet_squat', query: 'bodyweight squat proper form',
  }),
  S({
    id: 'hip_hinge', name: 'Hip Hinge (Good Morning)', muscles: ['Hamstrings', 'Glutes', 'Lower back'],
    steps: ['Stand tall, hands behind your head, soft bend in the knees.', 'Push your hips straight back as your chest tips forward, back flat.', 'Squeeze your glutes to return to standing.'],
    tips: ['Imagine closing a car door with your hips.', 'Feel the stretch in the back of your thighs.'],
    mistakes: ['Rounding the lower back.', 'Squatting down instead of pushing the hips back.'],
    harderId: 'rdl', query: 'hip hinge good morning exercise form',
  }),
  S({
    id: 'arm_circles', name: 'Arm Circles', muscles: ['Shoulders'],
    steps: ['Stand tall with arms straight out to the sides.', 'Make small circles, gradually getting bigger.', 'Reverse direction halfway.'],
    tips: ['Keep your neck relaxed.'],
    mistakes: ['Shrugging up towards your ears.'],
    query: 'arm circles shoulder warm up',
  }),
  S({
    id: 'cat_cow', name: 'Cat-Cow', muscles: ['Spine', 'Core'],
    steps: ['Start on hands and knees, hands under shoulders, knees under hips.', 'Inhale: drop your belly and look up (cow).', 'Exhale: round your back towards the ceiling and tuck your chin (cat).'],
    tips: ['Move slowly with your breathing.'],
    mistakes: ['Rushing through the movement.'],
    query: 'cat cow stretch how to',
  }),
  T('core', {
    id: 'plank', name: 'Plank', muscles: ['Core', 'Shoulders', 'Glutes'],
    steps: ['Forearms on the floor, elbows under shoulders, legs straight.', 'Squeeze glutes and brace your abs so your body forms one straight line.', 'Breathe steadily and hold for the full time.'],
    tips: ['Push the floor away through your forearms.', 'Tuck your pelvis slightly - imagine pulling your belt buckle to your chin.'],
    mistakes: ['Hips sagging or piking up.', 'Holding your breath.'],
    harderId: 'ab_rollout', query: 'plank proper form core',
  }),

  // ───────── Lower body ─────────
  S({
    id: 'goblet_squat', name: 'Goblet Squat', muscles: ['Quads', 'Glutes', 'Core'], loaded: true, increment: 2, mainLift: true,
    steps: ['Hold one dumbbell vertically against your chest with both hands.', 'Feet shoulder-width, toes slightly out. Sit your hips down between your knees.', 'Keep your chest tall; drive up through your whole foot.'],
    tips: ['Elbows inside the knees at the bottom helps you open the hips.', 'Brace your core like you are about to be poked in the stomach.'],
    mistakes: ['Leaning forward and dropping the weight.', 'Cutting depth short.'],
    easierId: 'bodyweight_squat', harderId: 'back_squat', query: 'goblet squat form tutorial',
  }),
  S({
    id: 'back_squat', name: 'Barbell Back Squat', muscles: ['Quads', 'Glutes', 'Core'], loaded: true, increment: 5, mainLift: true,
    steps: ['Set the bar on your upper back (not your neck), grip just outside the shoulders.', 'Unrack, step back, feet shoulder-width. Take a big breath and brace.', 'Sit down and back until thighs are at least parallel, then drive up.'],
    tips: ['Use safety pins in the rack and ask for a first-time form check.', 'Keep the bar over your mid-foot the whole way.'],
    mistakes: ['Knees collapsing inward.', 'Letting the chest fall forward out of the hole.'],
    easierId: 'goblet_squat', harderId: 'pause_squat', query: 'barbell back squat proper form',
  }),
  S({
    id: 'pause_squat', name: 'Pause Squat', muscles: ['Quads', 'Glutes', 'Core'], loaded: true, increment: 2.5, mainLift: true,
    steps: ['Set up exactly like a back squat.', 'Descend under control and pause for 2 seconds in the bottom position, staying tight.', 'Drive up powerfully.'],
    tips: ['Do not relax at the bottom - stay braced.', 'Use about 80-85% of your normal squat weight.'],
    mistakes: ['Bouncing out of the bottom.', 'Losing upper-back tightness during the pause.'],
    easierId: 'back_squat', query: 'pause squat how to',
  }),
  S({
    id: 'rdl', name: 'Romanian Deadlift', muscles: ['Hamstrings', 'Glutes', 'Lower back'], loaded: true, increment: 5, mainLift: true,
    steps: ['Hold dumbbells or a bar in front of your thighs, soft knees.', 'Push your hips back, sliding the weight down your legs until you feel a hamstring stretch.', 'Squeeze your glutes and drive your hips forward to stand.'],
    tips: ['Keep the weight close to your legs.', 'Stop when your back would start to round - flexibility, not depth, decides range.'],
    mistakes: ['Rounding the back.', 'Bending the knees so much it becomes a squat.'],
    easierId: 'hip_hinge', harderId: 'deadlift', query: 'romanian deadlift form',
  }),
  S({
    id: 'deadlift', name: 'Deadlift (Trap-bar / Barbell)', muscles: ['Hamstrings', 'Glutes', 'Back', 'Grip'], loaded: true, increment: 5, mainLift: true,
    steps: ['Stand with the bar over mid-foot; hinge down and grip it just outside your legs.', 'Pull the slack out of the bar, chest up, back flat, and brace.', 'Push the floor away and stand tall; lower the bar by hinging back under control.'],
    tips: ['Trap-bar is the most beginner-friendly option.', 'Think "push the floor" rather than "pull the bar".'],
    mistakes: ['Jerking the bar off the floor.', 'Rounding the lower back.', 'Hyper-extending at the top.'],
    easierId: 'rdl', query: 'trap bar deadlift form tutorial',
  }),
  S({
    id: 'walking_lunge', name: 'Walking Lunge', muscles: ['Quads', 'Glutes'], perSide: true, loaded: true, increment: 2,
    steps: ['Hold dumbbells at your sides and take a long step forward.', 'Lower until both knees are about 90 degrees.', 'Push through the front heel and step the back foot through into the next lunge.'],
    tips: ['Take big enough steps that your front shin stays near vertical.', 'Keep your torso upright.'],
    mistakes: ['Steps too short, putting stress on the knee.', 'Front knee wobbling inward.'],
    easierId: 'reverse_lunge', query: 'walking lunge proper form',
  }),
  S({
    id: 'reverse_lunge', name: 'Reverse Lunge', muscles: ['Quads', 'Glutes'], perSide: true, loaded: true, increment: 2,
    steps: ['Stand tall, step one foot straight back.', 'Lower your back knee towards the floor, front shin vertical.', 'Push through the front foot to return to standing.'],
    tips: ['Reverse lunges are kinder to the knees than forward ones.', 'Hold a wall or rack for balance if needed.'],
    mistakes: ['Stepping back on a tightrope line - keep feet hip-width.'],
    harderId: 'walking_lunge', query: 'reverse lunge form',
  }),
  S({
    id: 'bulgarian_split_squat', name: 'Bulgarian Split Squat', muscles: ['Quads', 'Glutes'], perSide: true, loaded: true, increment: 2, mainLift: true,
    steps: ['Stand about two feet in front of a bench; rest the top of your back foot on it.', 'Lower straight down until your front thigh is parallel to the floor.', 'Drive through the front heel to stand. Finish all reps, then switch legs.'],
    tips: ['Lean slightly forward to bias the glutes, stay upright for the quads.', 'Find your distance with a couple of practice reps.'],
    mistakes: ['Standing too close to the bench.', 'Pushing off the back foot.'],
    easierId: 'reverse_lunge', query: 'bulgarian split squat how to',
  }),
  S({
    id: 'leg_press', name: 'Leg Press', muscles: ['Quads', 'Glutes'], loaded: true, increment: 5, mainLift: true,
    steps: ['Sit back with feet shoulder-width on the platform, mid-height.', 'Lower the platform until your knees are about 90 degrees.', 'Press through your whole foot without locking your knees.'],
    tips: ['Keep your lower back and hips glued to the pad.', 'Controlled 2-second descent.'],
    mistakes: ['Lowering so far your hips roll off the seat.', 'Locking the knees hard at the top.'],
    query: 'leg press proper form',
  }),
  S({
    id: 'calf_raise', name: 'Standing Calf Raise', muscles: ['Calves'], loaded: true, increment: 2.5,
    steps: ['Stand with the balls of your feet on a step or plate, heels free.', 'Rise as high as you can onto your toes.', 'Pause briefly, then lower slowly past the step level to stretch.'],
    tips: ['Slow lowering gives the best results.'],
    mistakes: ['Bouncing instead of pausing.'],
    query: 'standing calf raise form',
  }),
  T('strength', {
    id: 'farmers_carry', name: "Farmer's Carry", muscles: ['Grip', 'Core', 'Traps'], loaded: true, increment: 2,
    steps: ['Pick up a heavy dumbbell in each hand and stand tall.', 'Walk with short, quick steps for the whole time.', 'Set the weights down carefully by hinging.'],
    tips: ['Squeeze the handles as hard as you can.', 'Shoulders down and back; do not lean.'],
    mistakes: ['Shrugging and leaning to one side.'],
    easierId: 'suitcase_carry', query: 'farmers carry how to',
  }),
  T('strength', {
    id: 'suitcase_carry', name: 'Suitcase Carry', muscles: ['Obliques', 'Grip', 'Core'], perSide: true, loaded: true, increment: 2,
    steps: ['Hold one heavy dumbbell at your side.', 'Walk tall without letting your torso tilt towards the weight.', 'Switch hands and repeat.'],
    tips: ['Resisting the lean is the exercise - this is a core move.'],
    mistakes: ['Leaning away to counterbalance.'],
    query: 'suitcase carry exercise',
  }),
  S({
    id: 'glute_bridge', name: 'Glute Bridge', muscles: ['Glutes', 'Hamstrings'],
    steps: ['Lie on your back, knees bent, feet flat hip-width.', 'Drive through your heels and lift your hips until body forms a line from knees to shoulders.', 'Squeeze your glutes for a second, then lower.'],
    tips: ['Ribs down - do not arch your lower back at the top.'],
    mistakes: ['Pushing with the lower back rather than the glutes.'],
    query: 'glute bridge proper form',
  }),

  // ───────── Upper body ─────────
  S({
    id: 'db_bench_press', name: 'Dumbbell Bench Press', muscles: ['Chest', 'Triceps', 'Shoulders'], loaded: true, increment: 2, mainLift: true,
    steps: ['Lie on a flat bench, dumbbells at chest level, feet planted.', 'Press the dumbbells up until your arms are straight above your chest.', 'Lower under control until elbows are just below the bench line.'],
    tips: ['Pull your shoulder blades together and keep them there.', 'Elbows about 45-60 degrees from your body, not flared out wide.'],
    mistakes: ['Bouncing the weights at the bottom.', 'Lifting your hips off the bench.'],
    harderId: 'bench_press', query: 'dumbbell bench press form',
  }),
  S({
    id: 'bench_press', name: 'Barbell Bench Press', muscles: ['Chest', 'Triceps', 'Shoulders'], loaded: true, increment: 2.5, mainLift: true,
    steps: ['Lie with your eyes under the bar, shoulder blades pinched, feet planted.', 'Unrack and lower the bar to your mid-chest under control.', 'Press back up in a slight arc over your shoulders.'],
    tips: ['Always use a spotter or safety arms.', 'Wrap your thumbs around the bar.'],
    mistakes: ['Flaring elbows to 90 degrees.', 'Bouncing the bar off the chest.'],
    easierId: 'db_bench_press', query: 'barbell bench press proper form',
  }),
  S({
    id: 'knee_pushup', name: 'Knee Push-up', muscles: ['Chest', 'Triceps', 'Core'],
    steps: ['Hands slightly wider than shoulders, knees on the floor.', 'Keep a straight line from knees to head and lower your chest to the floor.', 'Press back up.'],
    tips: ['Squeeze your glutes so your hips do not sag.'],
    mistakes: ['Sticking your hips up in the air.'],
    harderId: 'pushup', query: 'knee push up form',
  }),
  S({
    id: 'pushup', name: 'Push-up', muscles: ['Chest', 'Triceps', 'Core'],
    steps: ['Hands slightly wider than shoulders, body in a straight line from head to heels.', 'Lower until your chest nearly touches the floor, elbows about 45 degrees.', 'Press the floor away to return to the top.'],
    tips: ['Think of a moving plank: abs and glutes tight throughout.', 'Do the set a few reps short of failure, stop before form breaks.'],
    mistakes: ['Hips sagging.', 'Flaring the elbows straight out.'],
    easierId: 'knee_pushup', query: 'perfect push up form',
  }),
  S({
    id: 'incline_db_press', name: 'Incline Dumbbell Press', muscles: ['Upper chest', 'Shoulders', 'Triceps'], loaded: true, increment: 2, mainLift: true,
    steps: ['Set a bench to about 30 degrees and sit back with dumbbells at your shoulders.', 'Press up until your arms are straight.', 'Lower slowly to chest level.'],
    tips: ['30 degrees works better than steeper - steep angles become a shoulder press.'],
    mistakes: ['Bench too steep.', 'Arching the lower back off the bench.'],
    easierId: 'db_bench_press', query: 'incline dumbbell press form',
  }),
  S({
    id: 'assisted_pullup', name: 'Assisted Pull-up / Band Pull-up', muscles: ['Lats', 'Biceps'], loaded: true, increment: 2.5, mainLift: true,
    steps: ['Kneel on the assist platform (or loop a band), hands just wider than shoulders.', 'Pull your chest towards the bar by driving elbows down.', 'Lower under control until your arms are straight.'],
    tips: ['Reduce assistance gradually over the weeks.', 'Weight shown = assist weight, so heavier is easier.'],
    mistakes: ['Kipping or swinging.'],
    harderId: 'lat_pulldown', query: 'assisted pull up machine how to',
  }),
  S({
    id: 'lat_pulldown', name: 'Lat Pulldown', muscles: ['Lats', 'Biceps'], loaded: true, increment: 2.5, mainLift: true,
    steps: ['Sit with thighs under the pads and grab the bar just wider than shoulders.', 'Lean back slightly and pull the bar to your upper chest, elbows down and back.', 'Control it back up until your arms are straight.'],
    tips: ['Think about pulling your elbows into your back pockets.', 'Do not use momentum.'],
    mistakes: ['Pulling the bar behind your neck.', 'Leaning way back and rowing it.'],
    easierId: 'assisted_pullup', harderId: 'pullup', query: 'lat pulldown proper form',
  }),
  S({
    id: 'pullup', name: 'Pull-up', muscles: ['Lats', 'Biceps', 'Core'], mainLift: true,
    steps: ['Hang from the bar with hands just wider than shoulders.', 'Brace your core and pull until your chin clears the bar.', 'Lower fully under control.'],
    tips: ['Start each rep by pulling your shoulder blades down.', 'Cannot do one yet? Use negatives (jump up, lower slowly).'],
    mistakes: ['Half reps.', 'Swinging to get up.'],
    easierId: 'lat_pulldown', harderId: 'weighted_pullup', query: 'how to do a pull up properly',
  }),
  S({
    id: 'weighted_pullup', name: 'Weighted Pull-up', muscles: ['Lats', 'Biceps', 'Core'], loaded: true, increment: 1.25, mainLift: true,
    steps: ['Attach a weight with a dip belt or hold a dumbbell between your feet.', 'Perform strict pull-ups, chin clearing the bar.', 'Lower fully each rep.'],
    tips: ['Add weight in tiny steps.'],
    mistakes: ['Letting the weight swing.'],
    easierId: 'pullup', query: 'weighted pull up how to',
  }),
  S({
    id: 'db_shoulder_press', name: 'Seated Dumbbell Shoulder Press', muscles: ['Shoulders', 'Triceps'], loaded: true, increment: 2, mainLift: true,
    steps: ['Sit with back support, dumbbells at shoulder height, palms forward.', 'Press overhead until your arms are straight, without shrugging.', 'Lower to ear level under control.'],
    tips: ['Brace your abs so you do not arch your back.'],
    mistakes: ['Arching hard through the lower back.'],
    query: 'seated dumbbell shoulder press form',
  }),
  S({
    id: 'seated_cable_row', name: 'Seated Cable Row', muscles: ['Mid-back', 'Lats', 'Biceps'], loaded: true, increment: 2.5,
    steps: ['Sit tall, feet on the plates, knees soft, handle in both hands.', 'Pull the handle to your stomach, elbows tight to your sides.', 'Pause, squeeze your shoulder blades, then extend slowly.'],
    tips: ['Think "chest proud" throughout.'],
    mistakes: ['Rocking the torso to move the weight.'],
    query: 'seated cable row proper form',
  }),
  S({
    id: 'face_pull', name: 'Face Pull', muscles: ['Rear delts', 'Upper back'], loaded: true, increment: 2.5,
    steps: ['Set a rope at face height and step back so there is tension.', 'Pull towards your face, elbows high, splitting the rope apart.', 'Squeeze your rear shoulders, then return slowly.'],
    tips: ['Light weight, perfect form. This is a posture builder.'],
    mistakes: ['Going too heavy and leaning back.'],
    query: 'face pull proper form',
  }),
  S({
    id: 'single_arm_row', name: 'Single-arm Dumbbell Row', muscles: ['Lats', 'Mid-back'], perSide: true, loaded: true, increment: 2, mainLift: true,
    steps: ['Place one hand and knee on a bench, back flat, dumbbell in your free hand.', 'Pull the dumbbell towards your hip, elbow close to your body.', 'Lower until the arm is fully straight.'],
    tips: ['Keep your shoulders square to the floor.'],
    mistakes: ['Twisting your torso to heave the weight.'],
    query: 'single arm dumbbell row form',
  }),
  T('strength', {
    id: 'dead_hang', name: 'Dead Hang', muscles: ['Grip', 'Shoulders', 'Lats'],
    steps: ['Grab a pull-up bar with an overhand grip, hands shoulder-width.', 'Hang with arms straight, shoulders slightly pulled down (not shrugged to your ears).', 'Breathe and hold for the time.'],
    tips: ['Grip strength is strongly linked with healthy ageing - it matters more than it looks.', 'Use a box to step up so you do not have to jump.'],
    mistakes: ['Dropping off early because of grip - chalk or straps are fine in the final seconds.'],
    harderId: 'pullup', query: 'dead hang exercise shoulders grip',
  }),

  // ───────── Core ─────────
  T('core', {
    id: 'side_plank', name: 'Side Plank', muscles: ['Obliques', 'Glutes'], perSide: true,
    steps: ['Lie on your side, elbow under your shoulder, legs stacked.', 'Lift your hips so your body forms a straight line.', 'Hold, then switch sides.'],
    tips: ['Drop the bottom knee to the floor to make it easier.'],
    mistakes: ['Hips sagging towards the floor.'],
    query: 'side plank proper form',
  }),
  S({
    id: 'dead_bug', name: 'Dead Bug', muscles: ['Deep core'], perSide: true,
    steps: ['Lie on your back, arms up, knees bent at 90 degrees over your hips.', 'Press your lower back into the floor; slowly lower the opposite arm and leg.', 'Return and switch sides.'],
    tips: ['If your lower back lifts off the floor, shorten the range.'],
    mistakes: ['Letting the back arch.', 'Moving too fast.'],
    harderId: 'hanging_knee_raise', query: 'dead bug exercise form',
  }),
  S({
    id: 'bird_dog', name: 'Bird Dog', muscles: ['Core', 'Glutes', 'Lower back'], perSide: true,
    steps: ['Start on hands and knees, back flat.', 'Reach one arm forward and the opposite leg back, hips level.', 'Pause, return, and switch sides.'],
    tips: ['Imagine a glass of water on your lower back.'],
    mistakes: ['Rotating the hips open.'],
    query: 'bird dog exercise form',
  }),
  S({
    id: 'pallof_press', name: 'Pallof Press', muscles: ['Obliques', 'Deep core'], perSide: true, loaded: true, increment: 2.5,
    steps: ['Stand side-on to a cable (or band) at chest height, handle at your chest.', 'Press the handle straight out in front of you without rotating.', 'Hold for a second, bring it back, then switch sides.'],
    tips: ['The goal is to resist being twisted.'],
    mistakes: ['Letting the cable pull your torso around.'],
    query: 'pallof press how to',
  }),
  S({
    id: 'hanging_knee_raise', name: 'Hanging Knee Raise', muscles: ['Lower abs', 'Hip flexors', 'Grip'],
    steps: ['Hang from a bar, shoulders slightly engaged.', 'Curl your knees up to your chest by tucking your pelvis.', 'Lower slowly without swinging.'],
    tips: ['Tilt your pelvis up at the top rather than just lifting the knees.'],
    mistakes: ['Swinging for momentum.'],
    easierId: 'dead_bug', harderId: 'hanging_leg_raise', query: 'hanging knee raise form',
  }),
  S({
    id: 'hanging_leg_raise', name: 'Hanging Leg Raise', muscles: ['Abs', 'Hip flexors', 'Grip'],
    steps: ['Hang from a bar with legs straight.', 'Raise your legs together until they are at least parallel to the floor.', 'Lower slowly under control.'],
    tips: ['Squeeze the bar to stop the swing.'],
    mistakes: ['Using momentum.'],
    easierId: 'hanging_knee_raise', query: 'hanging leg raise form',
  }),
  S({
    id: 'ab_rollout', name: 'Ab Wheel Rollout', muscles: ['Abs', 'Lats', 'Shoulders'],
    steps: ['Kneel, holding the wheel under your shoulders.', 'Roll out slowly, keeping your back flat and abs braced.', 'Roll back by pulling with your abs, not your hips.'],
    tips: ['Only roll as far as you can control without your back sagging.', 'Rest your knees on a mat.'],
    mistakes: ['Lower back sagging.'],
    easierId: 'plank', query: 'ab wheel rollout proper form',
  }),
  T('core', {
    id: 'hollow_hold', name: 'Hollow Body Hold', muscles: ['Abs'],
    steps: ['Lie on your back, press your lower back into the floor.', 'Lift your shoulders and straight legs a few inches off the floor, arms by your ears or at your sides.', 'Hold without letting your back arch.'],
    tips: ['Bend the knees to make it easier.'],
    mistakes: ['Lower back lifting off the floor.'],
    easierId: 'dead_bug', query: 'hollow body hold form',
  }),
  S({
    id: 'mountain_climber', name: 'Mountain Climber', muscles: ['Core', 'Shoulders', 'Hip flexors'], measure: 'time',
    steps: ['Start in a high plank, hands under shoulders.', 'Drive one knee towards your chest, then switch quickly.', 'Keep your hips low and your core braced.'],
    tips: ['Slow it down if your hips start bouncing up.'],
    mistakes: ['Hips piking high.'],
    query: 'mountain climbers form',
  }),

  // ───────── Cardio / conditioning ─────────
  T('cardio', {
    id: 'interval_bike', name: 'Hard Interval (Bike / Rower / Incline Treadmill)', muscles: ['Heart', 'Legs'],
    steps: ['Each round: push hard for the work time (about 8/10 effort), then ease off completely.', 'Use the rest to bring your breathing down.', 'Tick off each round as you finish it.'],
    tips: ['Hard means you could only say a few words. Not a sprint to exhaustion.', 'Quality intervals raise VO2 max, one of the strongest longevity markers.'],
    mistakes: ['Going all-out on round 1 and fading.', 'Not resting properly between rounds.'],
    query: 'HIIT intervals stationary bike 30 seconds how to',
  }),
  T('cardio', {
    id: 'incline_walk', name: 'Incline Walk', muscles: ['Glutes', 'Calves', 'Heart'],
    steps: ['Set the treadmill to 10-12% incline and 5-5.5 km/h.', 'Walk with an upright posture without holding the handrails.', 'Settle in and keep a steady pace.'],
    tips: ['Holding the rails reduces the calories burned.'],
    mistakes: ['Leaning on the handles.'],
    query: 'incline treadmill walking 12 3 30',
  }),
  S({
    id: 'kb_swing', name: 'Kettlebell Swing', muscles: ['Glutes', 'Hamstrings', 'Core'], measure: 'time', loaded: true, increment: 2,
    steps: ['Stand over the kettlebell, hinge back and hike it between your legs.', 'Snap your hips forward to float the bell to chest height.', 'Let it fall and hinge again, keeping your back flat.'],
    tips: ['It is a hip hinge, not a squat or arm lift.'],
    mistakes: ['Lifting with the arms.', 'Rounding the back at the bottom.'],
    query: 'kettlebell swing proper form',
  }),
  S({
    id: 'inverted_row', name: 'TRX / Cable Row', muscles: ['Back', 'Biceps'], measure: 'time',
    steps: ['Hold the handles, lean back with your body in a straight line.', 'Pull your chest to the handles, elbows close.', 'Lower with control.'],
    tips: ['Walk your feet forward to make it harder.'],
    mistakes: ['Sagging hips.'],
    query: 'TRX row form',
  }),
  T('cardio', {
    id: 'brisk_walk', name: 'Brisk Walk', muscles: ['Heart', 'Legs'],
    steps: ['Walk at a pace where you can talk but feel slightly warm.', 'Swing your arms and keep your head up.', 'Outdoors in daylight is best for the sleep and vitamin D benefits.'],
    tips: ['Morning sunlight also helps reset your body clock.'],
    mistakes: ['Strolling - pick up the pace.'],
    query: 'brisk walking benefits technique',
  }),

  // ───────── Mobility ─────────
  T('mobility', {
    id: 'hip_flexor_stretch', name: 'Hip Flexor Stretch', muscles: ['Hip flexors'], perSide: true,
    steps: ['Kneel on one knee with the other foot forward.', 'Tuck your pelvis under and gently push your hips forward.', 'Hold and breathe, then switch sides.'],
    tips: ['Squeeze the glute on the kneeling side to deepen the stretch.'],
    mistakes: ['Arching your lower back instead of tucking.'],
    query: 'kneeling hip flexor stretch',
  }),
  T('mobility', {
    id: 'pigeon', name: 'Pigeon Pose', muscles: ['Glutes', 'Hips'], perSide: true,
    steps: ['From hands and knees, bring one knee forward behind your wrist and extend the other leg back.', 'Lower your hips, fold forward over your front shin.', 'Hold, then switch sides.'],
    tips: ['Put a cushion under your hip if it does not reach the floor.'],
    mistakes: ['Forcing the knee - go to a mild stretch only.'],
    query: 'pigeon pose hip stretch beginner',
  }),
  T('mobility', {
    id: 'hamstring_stretch', name: 'Hamstring Stretch', muscles: ['Hamstrings'], perSide: true,
    steps: ['Sit on the floor with one leg straight, the other foot against your thigh.', 'Hinge forward from the hips towards your toes with a flat back.', 'Hold, then switch.'],
    tips: ['Stop where you feel a gentle stretch, not a pull.'],
    mistakes: ['Rounding your back to reach further.'],
    query: 'seated hamstring stretch',
  }),
  T('mobility', {
    id: 'thoracic_rotation', name: 'Thoracic Spine Rotation', muscles: ['Upper back'], perSide: true,
    steps: ['On hands and knees, place one hand behind your head.', 'Rotate that elbow down, then open it up towards the ceiling.', 'Follow your elbow with your eyes.'],
    tips: ['Move slowly and breathe out as you rotate up.'],
    mistakes: ['Rotating from the lower back.'],
    query: 'thoracic rotation quadruped',
  }),
  T('mobility', {
    id: 'deep_squat_hold', name: 'Deep Squat Hold', muscles: ['Hips', 'Ankles'],
    steps: ['Squat as low as you comfortably can with feet slightly wider than your shoulders.', 'Press your elbows against your knees and keep your chest up.', 'Hold and breathe.'],
    tips: ['Hold on to a pole or rack if you need support.'],
    mistakes: ['Heels lifting - put a small plate under them.'],
    query: 'deep squat hold mobility',
  }),
  T('mobility', {
    id: 'childs_pose', name: "Child's Pose", muscles: ['Back', 'Hips'],
    steps: ['Kneel and sit back on your heels.', 'Reach your arms forward and lower your chest towards the floor.', 'Breathe slowly into your back.'],
    tips: ['Separate the knees if it feels tight in the hips.'],
    mistakes: ['Holding your breath.'],
    query: 'childs pose how to',
  }),
  T('mobility', {
    id: 'doorway_chest', name: 'Doorway Chest Stretch', muscles: ['Chest', 'Shoulders'], perSide: true,
    steps: ['Stand in a doorway, forearm on the frame with the elbow at shoulder height.', 'Step forward gently until you feel a chest stretch.', 'Hold, then switch.'],
    tips: ['Vary the arm height to change the stretch.'],
    mistakes: ['Pushing into a sharp pinch in the shoulder.'],
    query: 'doorway chest stretch',
  }),
]

export const EXERCISE_MAP: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]))

export function getExercise(id: string): Exercise {
  return (
    EXERCISE_MAP[id] ?? {
      id,
      name: id,
      muscles: [],
      type: 'strength',
      measure: 'reps',
      steps: [],
      tips: [],
      mistakes: [],
      query: id,
    }
  )
}

export const youtubeSearchUrl = (ex: Exercise) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(ex.query + ' exercise tutorial')}`

/** Accepts a full YouTube URL or a bare 11-char id. Returns the id or null. */
export function parseYoutubeId(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  try {
    const u = new URL(s)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1).slice(0, 11) || null
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      const m = u.pathname.match(/\/(?:embed|shorts)\/([\w-]{11})/)
      if (m) return m[1]
    }
  } catch {
    /* not a URL */
  }
  return null
}
