export default function CSSTestPage() {
  return (
    <div>
      <h1>CSS Test Page</h1>
      
      {/* Basic Tailwind Test */}
      <div className="bg-red-500 text-white p-4 m-4 rounded-lg">
        RED BOX: If this is red with white text, basic Tailwind is working
      </div>
      
      <div className="bg-blue-500 text-white p-4 m-4 rounded-lg shadow-lg">
        BLUE BOX: If this is blue with shadow, Tailwind is processing
      </div>
      
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 m-4 rounded-lg">
        GRADIENT: If this has a gradient, advanced Tailwind features work
      </div>
      
      {/* Grid Test */}
      <div className="grid grid-cols-3 gap-4 m-4">
        <div className="bg-green-500 p-4 text-white rounded">Grid 1</div>
        <div className="bg-yellow-500 p-4 text-white rounded">Grid 2</div>
        <div className="bg-indigo-500 p-4 text-white rounded">Grid 3</div>
      </div>
      
      {/* Flexbox Test */}
      <div className="flex justify-between items-center bg-gray-200 p-4 m-4 rounded">
        <span>Left</span>
        <span>Center</span>
        <span>Right</span>
      </div>
    </div>
  );
}