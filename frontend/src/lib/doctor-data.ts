export const overviewStats = {
  totalPayableIncome: 'LKR 1,250,500.75',
  channelingSessions: 42,
  surgeryRecords: 115,
};

export const recentActivities = [
  { id: 1, description: "New channeling session added for Lakeside Hospital.", timestamp: "2 hours ago" },
  { id: 2, description: "Uploaded post-op instructions for Appendectomy.", timestamp: "5 hours ago" },
  { id: 3, description: "Patient record for 'John Doe' was updated.", timestamp: "1 day ago" },
  { id: 4, description: "Monthly finance report generated.", timestamp: "2 days ago" },
];

export const hospitalData = [
  {
    id: 1,
    name: "Lakeside Hospital",
    channeling: [
      { id: 1, date: "2024-07-20", patientCount: 15, totalIncome: 75000 },
      { id: 2, date: "2024-07-18", patientCount: 12, totalIncome: 60000 },
      { id: 3, date: "2024-07-15", patientCount: 20, totalIncome: 100000 },
    ],
    surgical: [
      { id: 1, patientBHT: "BHT-0789", date: "2024-07-19", totalAmount: 150000 },
      { id: 2, patientBHT: "BHT-0782", date: "2024-07-12", totalAmount: 220000 },
    ]
  },
  {
    id: 2,
    name: "Central City Medical",
     channeling: [
      { id: 1, date: "2024-07-21", patientCount: 18, totalIncome: 90000 },
      { id: 2, date: "2024-07-17", patientCount: 10, totalIncome: 50000 },
    ],
    surgical: [
      { id: 1, patientBHT: "CCM-5543", date: "2024-07-16", totalAmount: 300000 },
      { id: 2, patientBHT: "CCM-5510", date: "2024-07-10", totalAmount: 180000 },
    ]
  }
];

export const patientRecords = [
    { id: 1, name: "Maria Garcia", nic: "198812345678", hospital: "Lakeside Hospital", surgery: "Appendectomy", cardPhotoId: "patient-card-1" },
    { id: 2, name: "John Doe", nic: "199209876543", hospital: "Central City Medical", surgery: "Knee Replacement", cardPhotoId: "patient-card-2" },
    { id: 3, name: "Susan Smith", nic: "197501012345", hospital: "Lakeside Hospital", surgery: "Gallbladder Removal", cardPhotoId: "patient-card-3" },
];

export const surgeryInstructions = [
    { 
        id: 1,
        surgeryName: "Appendectomy",
        description: "Standard procedure for appendix removal.",
        preOp: { video: "appendectomy_pre_op.mp4", audio: null, document: "appendectomy_guide.pdf" },
        postOp: { video: "appendectomy_post_op.mp4", audio: "post_op_recovery.mp3", document: null }
    },
    { 
        id: 2,
        surgeryName: "Knee Replacement",
        description: "Total knee arthroplasty.",
        preOp: { video: "knee_pre_op.mp4", audio: null, document: "knee_guide.pdf" },
        postOp: { video: null, audio: null, document: "knee_recovery.pdf" }
    },
];
