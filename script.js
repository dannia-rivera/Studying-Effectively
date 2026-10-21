const timerDisplay = document.getElementById('timer');
const modeButtons = document.querySelectorAll('.mode');
const sessionDisplay = document.getElementById('sessions');
const totalDisplay = document.getElementById('total');
const goalInput = document.getElementById('goal');
const progressBar = document.getElementById('progress-bar');
const goalLabel = document.getElementById('goal-label');
let selectedMinutes = 25;
let secondsRemaining = selectedMinutes * 60;
let intervalId = null;
let completedSessions = 0;
let completedMinutes = 0;
let currentModeIsFocus = true;
function renderTimer() {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}
function stopTimer() { clearInterval(intervalId); intervalId = null; }
function updateProgress() {
  const goal = Math.max(1, Number(goalInput.value) || 50);
  goalLabel.textContent = `${completedMinutes} / ${goal} minutes`;
  progressBar.style.width = `${Math.min(100, completedMinutes / goal * 100)}%`;
  sessionDisplay.textContent = completedSessions;
  totalDisplay.textContent = `${completedMinutes} minutes completed`;
}
document.getElementById('start').addEventListener('click', () => {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      stopTimer();
      secondsRemaining = 0;
      if (currentModeIsFocus) { completedSessions++; completedMinutes += selectedMinutes; updateProgress(); }
      alert('Session complete!');
    }
    renderTimer();
  }, 1000);
});
document.getElementById('pause').addEventListener('click', stopTimer);
document.getElementById('reset').addEventListener('click', () => { stopTimer(); secondsRemaining = selectedMinutes * 60; renderTimer(); });
modeButtons.forEach(button => button.addEventListener('click', () => {
  stopTimer();
  modeButtons.forEach(b => b.classList.remove('selected'));
  button.classList.add('selected');
  selectedMinutes = Number(button.dataset.minutes);
  currentModeIsFocus = selectedMinutes === 25;
  secondsRemaining = selectedMinutes * 60;
  renderTimer();
}));
goalInput.addEventListener('input', updateProgress);
const cameraButton = document.getElementById('camera-toggle');
const video = document.getElementById('video');
const cameraPlaceholder = document.getElementById('camera-placeholder');
let stream = null;
cameraButton.addEventListener('click', async () => {
  if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null; video.srcObject = null; video.hidden = true; cameraPlaceholder.hidden = false; cameraButton.textContent = 'Turn on camera'; return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({video:true,audio:false});
    video.srcObject = stream;
    video.hidden = false;
    cameraPlaceholder.hidden = true;
    cameraButton.textContent = 'Turn off camera';
  } catch (error) { alert('Camera access is unavailable. Allow camera permission and try localhost or HTTPS.'); }
});
window.addEventListener('pagehide', () => { if(stream) stream.getTracks().forEach(track=>track.stop()); });
renderTimer(); updateProgress();
