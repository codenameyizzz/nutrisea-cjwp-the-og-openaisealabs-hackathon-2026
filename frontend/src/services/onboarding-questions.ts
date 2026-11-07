export const ONBOARDING_QUESTIONS = [
  {
    id: "q1",
    num: 1,
    categoryBadge: "Nutrition goals",
    title: "What is your main goal when choosing food?",
    options: [
      {
        value: "Keep my energy steady and choose a balanced meal.",
        label: "Keep my energy steady and choose a balanced meal."
      },
      {
        value: "Eat healthier and reduce my risk of future health problems.",
        label: "Eat healthier and reduce my risk of future health problems."
      },
      {
        value: "Build muscle or support my fitness progress.",
        label: "Build muscle or support my fitness progress."
      },
      {
        value: "Choose food that is gentle on my stomach.",
        label: "Choose food that is gentle on my stomach."
      },
      {
        value: "I'm not sure yet.",
        label: "I'm not sure yet."
      }
    ]
  },
  {
    id: "q2",
    num: 2,
    categoryBadge: "Food-related concerns",
    title: "What is your main food-related concern right now?",
    options: [
      {
        value: "I often feel sleepy, sluggish, or too full after lunch.",
        label: "I often feel sleepy, sluggish, or too full after lunch."
      },
      {
        value: "I want to be more careful about things like salt, sugar, or fat.",
        label: "I want to be more careful about things like salt, sugar, or fat."
      },
      {
        value: "I want enough protein without spending too much.",
        label: "I want enough protein without spending too much."
      },
      {
        value: "Some foods can trigger stomach discomfort, acidity, or heartburn.",
        label: "Some foods can trigger stomach discomfort, acidity, or heartburn."
      },
      {
        value: "None of these.",
        label: "None of these."
      }
    ]
  },
  {
    id: "q3",
    num: 3,
    categoryBadge: "Dietary and health needs",
    title: "Are there any dietary needs or restrictions we should consider?",
    options: [
      {
        value: "I need to limit salt.",
        label: "I need to limit salt."
      },
      {
        value: "I need to be mindful of sugar or blood glucose.",
        label: "I need to be mindful of sugar or blood glucose."
      },
      {
        value: "I need to be mindful of cholesterol or saturated fat.",
        label: "I need to be mindful of cholesterol or saturated fat."
      },
      {
        value: "I need food that is gentle on my stomach.",
        label: "I need food that is gentle on my stomach."
      },
      {
        value: "I have a food allergy or intolerance.",
        label: "I have a food allergy or intolerance."
      },
      {
        value: "I don't have any specific dietary restrictions.",
        label: "I don't have any specific dietary restrictions."
      },
      {
        value: "Prefer not to say.",
        label: "Prefer not to say."
      }
    ],
    followUp: {
      categoryBadge: "Reason for your dietary needs",
      title: "Are these needs based on professional healthcare advice or personal preference?",
      options: [
        {
          value: "Guidance from a healthcare professional",
          label: "Guidance from a healthcare professional"
        },
        {
          value: "Personal preference",
          label: "Personal preference"
        },
        {
          value: "Prefer not to say",
          label: "Prefer not to say"
        }
      ]
    }
  },
  {
    id: "q4",
    num: 4,
    categoryBadge: "Lunch priorities",
    title: "What matters most when you choose lunch?",
    options: [
      {
        value: "I want a quick recommendation so I don't have to browse many options.",
        label: "I want a quick recommendation so I don't have to browse many options."
      },
      {
        value: "I want a meal that supports my long-term health.",
        label: "I want a meal that supports my long-term health."
      },
      {
        value: "I want good nutrition and enough protein at an affordable price.",
        label: "I want good nutrition and enough protein at an affordable price."
      },
      {
        value: "I want to avoid ingredients or preparation styles that may upset my stomach.",
        label: "I want to avoid ingredients or preparation styles that may upset my stomach."
      },
      {
        value: "I mainly want to choose based on taste.",
        label: "I mainly want to choose based on taste."
      }
    ]
  },
  {
    id: "q5",
    num: 5,
    categoryBadge: "Meal budget",
    title: "What is your usual budget for one lunch?",
    options: [
      {
        value: "Under Rp25,000",
        label: "Under Rp25,000"
      },
      {
        value: "Rp25,000–Rp35,000",
        label: "Rp25,000–Rp35,000"
      },
      {
        value: "Rp35,001–Rp45,000",
        label: "Rp35,001–Rp45,000"
      },
      {
        value: "More than Rp45,000",
        label: "More than Rp45,000"
      },
      {
        value: "It depends on the day",
        label: "It depends on the day"
      }
    ]
  },
  {
    id: "q6",
    num: 6,
    categoryBadge: "Activity level",
    title: "How active is your usual day?",
    options: [
      {
        value: "Mostly sitting; little planned exercise",
        label: "Mostly sitting; little planned exercise"
      },
      {
        value: "Light activity or occasional exercise",
        label: "Light activity or occasional exercise"
      },
      {
        value: "Moderate activity or regular exercise",
        label: "Moderate activity or regular exercise"
      },
      {
        value: "Very active or frequent intense exercise",
        label: "Very active or frequent intense exercise"
      },
      {
        value: "Not sure",
        label: "Not sure"
      }
    ]
  },
  {
    id: "q7",
    num: 7,
    categoryBadge: "Age group (optional)",
    title: "What is your age group?",
    options: [
      { value: "Under 21", label: "Under 21" },
      { value: "21–27", label: "21–27" },
      { value: "28–33", label: "28–33" },
      { value: "34–48", label: "34–48" },
      { value: "49 or older", label: "49 or older" },
      { value: "Prefer not to say", label: "Prefer not to say" }
    ]
  },
  {
    id: "q8",
    num: 8,
    categoryBadge: "Difficulties choosing food",
    title: "What usually makes choosing lunch difficult?",
    options: [
      {
        value: "Too many options; I spend too much time deciding.",
        label: "Too many options; I spend too much time deciding."
      },
      {
        value: "I'm unsure whether a meal is balanced or healthy.",
        label: "I'm unsure whether a meal is balanced or healthy."
      },
      {
        value: "Healthy food often costs more than I want to spend.",
        label: "Healthy food often costs more than I want to spend."
      },
      {
        value: "I'm worried a meal may trigger stomach discomfort.",
        label: "I'm worried a meal may trigger stomach discomfort."
      },
      {
        value: "I find it difficult to estimate nutrition information.",
        label: "I find it difficult to estimate nutrition information."
      },
      {
        value: "None of these.",
        label: "None of these."
      }
    ]
  }
];
