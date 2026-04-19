# SARA: Security Analysis & Response Assistant

SARA is a real-time monitoring dashboard that uses computer vision to assist security officers at residentials in identifying and responding to incidents. The system analyzes live video to detect emergencies and provides an interface for incident management and reporting.

Click [here](https://canva.link/mcvbppbj22845vg) to access the demo video + solution deck.

## 🛠 Key Functions

1. **AI-Powered Alert Triggers**
   
   i) **Medical Emergencies (Fall Detection):** Triggers when a person's posture stays horizontal for a set number of frames to confirm a fall.

   ii) **Potential Theft:** Triggers when a registered object is removed from the frame immediately after being handled by a person.
   
   iii) **Unattended Object:** Triggers when an object remains stationary with no person detected nearby for some time, the system flags it as a security risk or obstruction.

   iv) **Delivery in Progress:** Identifies a delivery when a person is detected with a bag, suitcase or helmet, classifying them as courier.
      
   v) **Visual Snapshots:** Every alert automatically captures a photo of the incident for immediate verification.
   
3. **Command Dashboard**
   
   i) **Interactive Map:** A 2D floor plan highlights the exact location of an alert with a red glow.
   
   ii) **Incident Playbooks:** The dashboard provides a step-by-step general checklist to handle the incident detected.
   
   iii) **Audit PDF:** Resolving an incident generates a PDF report containing the event details, timestamps, and the incident snapshot.

## Technical Architecture 

1. **The Brain (Backend):** Python/YOLOv8 for real-time object tracking and behavioral state analysis.
2. **The Body (Frontend):** React/Vite dashboard built with Tailwind CSS and ShadcnUI.
3. **The Bridge:** Local Flask REST API for telemetry and Supabase Edge Functions for cloud-based Telegram escalation.


## 🚀 Local Installation

1. **Python AI Engine**

   ```bash
   # Install required libraries
   pip install -r requirements.txt

   # Start the detection server
   python detection_server.py
   
*Note: Ensure a webcam is connected. The server runs on port 5000.*

2. **React Dashboard**
   ```bash
   # Install dependencies
   npm install

   # Start the interface
   npm run dev

*Access the site at http://localhost:5173.*

## 

*Developed for Certis NAISC 2026.*
