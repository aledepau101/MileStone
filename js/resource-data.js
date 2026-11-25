"use strict";

const resources = [
    {
        id: "writing-resources-center",
        name: "Writing Resources Center",
        description: "Get individualized feedback based on writer strengths, goals, and interested.",
        icon: "pencil",
        tags: ["Writing support", "Appointments"],
        url: "https://wrc.charlotte.edu/",
        featured: true,
    },
    {
        id: "university-library-research-help",
        name: "University Library Research Help",
        description: "Meet with a subject librarian for databases, citations, literature searches.",
        icon: "book",
        tags: ["Research", "Citation help"],
        url: "https://library.charlotte.edu/research-write/get-research-help/research-help",
        featured: true,
    },
    {
        id: "graduate-writing-center",
        name: "Graduate Writing Center",
        description: "Find writing programs for graduate students to refine writing and communication skills.",
        icon: "users",
        tags: ["Writing Support", "Wellbeing"],
        url: "https://gradlife.charlotte.edu/graduate-postdoctoral-writing-center/",
        featured: true,
    },
    {
        id: "citation-reference-help",
        name: "Citation Reference Help",
        description: "Help students format citations and bibliographies in APA, MLA, or Chicago Style",
        icon: "file-document",
        tags: ["Formatting", "Citation help"],
        url: null,
        featured: false,
    },
    {
        id: "graduate-funding-grants",
        name: "Graduate Funding & Grants",
        description: "Find information about research grants, thesis funding, scholarships, and financial assistance.",
        icon: "diamond",
        tags: ["Funding", "Scholarships"],
        url: null,
        featured: false,
    },
    {
        id: "graduate-workshops-events",
        name: "Graduate Workshops & Events",
        description: "Discover thesis-writing workshops, research presentations, academic seminars, and graduate student events.",
        icon: "users",
        tags: ["Workshops", "Events"],
        url: null,
        featured: false,
    },
];

const resourceDataExports = { resources };

if (typeof module === "object" && module.exports) {
    module.exports = resourceDataExports;
}

if (typeof globalThis === "object") {
    globalThis.resourceData = resourceDataExports;
}
