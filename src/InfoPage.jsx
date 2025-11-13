import React from "react";
import { FileSpreadsheet, Users, Zap, CheckCircle } from "lucide-react";

const InfoPage = ({ theme }) => {
  const isDark = theme === "dark";

  const features = [
    {
      icon: FileSpreadsheet,
      title: "VAHAN Data Processor",
      description:
        "Automatically fill customer names in VAHAN Excel files for vehicle registration",
      useCases: [
        "Process registration charges entry in Tally",
        "Match chassis numbers with customer names from FORM22",
        "Bulk update VAHAN data without manual entry",
        "Save hours of data entry time",
      ],
      howToUse: [
        "Export FORM22 file containing chassis numbers and customer names",
        "Export VAHAN Excel file that needs customer names",
        "Upload both files to the VAHAN page",
        'Click "Process Files" to match and update names',
        "Download the updated VAHAN file with all names filled",
      ],
    },
    {
      icon: Users,
      title: "DMS Names Cleaner",
      description:
        "Remove trailing numbers from customer names for Tally extended warranty entry",
      useCases: [
        "Clean extended warranty customer data from DMS",
        "Remove unwanted ID numbers from names",
        "Prepare data for Tally import",
        "Standardize name format across systems",
      ],
      howToUse: [
        "Export extended warranty Excel file from DMS",
        "Upload the file to DMS Names page",
        'Click "Process File" to remove numbers like (123456)',
        "Download the cleaned file",
        "Copy-paste clean names directly into Tally",
      ],
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Hero Section */}
      <div className="mb-12 text-center">
        <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 mb-4">
          <Zap className="text-white" size={48} />
        </div>
        <h1
          className={`text-5xl font-bold mb-4 ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          Excel Automation Tools
        </h1>
        <p
          className={`text-xl ${
            isDark ? "text-gray-400" : "text-gray-600"
          } max-w-2xl mx-auto`}
        >
          Streamline your data entry workflow with powerful automation tools
          designed for vehicle registration and Tally integration
        </p>
      </div>

      {/* Features Grid */}
      <div className="space-y-8 mb-12">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div
              key={index}
              className={`rounded-2xl shadow-2xl p-8 ${
                isDark ? "bg-gray-800/50 backdrop-blur-sm" : "bg-white"
              }`}
            >
              <div className="flex items-start gap-4 mb-6">
                <div
                  className={`p-3 rounded-xl ${
                    isDark ? "bg-blue-600" : "bg-blue-500"
                  }`}
                >
                  <Icon className="text-white" size={32} />
                </div>
                <div>
                  <h2
                    className={`text-3xl font-bold mb-2 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {feature.title}
                  </h2>
                  <p
                    className={`text-lg ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {feature.description}
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Use Cases */}
                <div>
                  <h3
                    className={`text-xl font-semibold mb-4 ${
                      isDark ? "text-gray-300" : "text-gray-800"
                    }`}
                  >
                    What it does:
                  </h3>
                  <ul className="space-y-3">
                    {feature.useCases.map((useCase, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <CheckCircle
                          className={`flex-shrink-0 mt-0.5 ${
                            isDark ? "text-green-400" : "text-green-500"
                          }`}
                          size={20}
                        />
                        <span
                          className={isDark ? "text-gray-300" : "text-gray-700"}
                        >
                          {useCase}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* How to Use */}
                <div>
                  <h3
                    className={`text-xl font-semibold mb-4 ${
                      isDark ? "text-gray-300" : "text-gray-800"
                    }`}
                  >
                    How to use:
                  </h3>
                  <ol className="space-y-3">
                    {feature.howToUse.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span
                          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                            isDark
                              ? "bg-blue-600 text-white"
                              : "bg-blue-500 text-white"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span
                          className={isDark ? "text-gray-300" : "text-gray-700"}
                        >
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          );
        })}
        {/* Example Section */}
        <div
          className={`mb-6 p-4 rounded-xl ${
            isDark ? "bg-gray-700/50" : "bg-blue-50"
          }`}
        >
          <h3
            className={`text-sm font-semibold mb-2 ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Example:
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p
                className={`font-medium mb-1 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Before:
              </p>
              <p className={isDark ? "text-gray-300" : "text-gray-700"}>
                VINAG SV(9480494529)
              </p>
              <p className={isDark ? "text-gray-300" : "text-gray-700"}>
                ANNAPURNA(2564801725)
              </p>
            </div>
            <div>
              <p
                className={`font-medium mb-1 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                After:
              </p>
              <p className={isDark ? "text-gray-300" : "text-gray-700"}>
                VINAG SV
              </p>
              <p className={isDark ? "text-gray-300" : "text-gray-700"}>
                ANNAPURNA
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div
        className={`mt-8 text-center p-6 rounded-xl ${
          isDark ? "bg-gray-800/50" : "bg-gray-100"
        }`}
      >
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
          all rights reserved vinu
        </p>
      </div>
    </div>
  );
};

export default InfoPage;
